import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

// Helper: Extract verification code from message
async function getExtractedCode(base44, emailId, messageId) {
  const emailRecord = await base44.asServiceRole.entities.InPlatformEmail.get(emailId).catch(() => null);
  if (!emailRecord) return null;
  const messages = Array.isArray(emailRecord.messages) ? emailRecord.messages : [];
  const msg = messages.find(m => m.message_id === messageId);
  return msg?.verification_code || null;
}

// Helper: Extract confirmation link from message
async function getExtractedLink(base44, emailId, messageId) {
  const emailRecord = await base44.asServiceRole.entities.InPlatformEmail.get(emailId).catch(() => null);
  if (!emailRecord) return null;
  const messages = Array.isArray(emailRecord.messages) ? emailRecord.messages : [];
  const msg = messages.find(m => m.message_id === messageId);
  return msg?.confirmation_link || null;
}

/**
 * AUTOPILOT MAILBOX ENGINE v1.0
 * Autonomously receives, parses, and extracts verification codes/links from incoming emails.
 * Syncs extracted data to Identity Hub and Credential Vault for autonomous account sign-ups.
 * 
 * Triggered by:
 * - Scheduled automation (every 5 minutes)
 * - Webhook from email providers (when new message arrives)
 * - Manual invocation via agentWorker
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));

    const user = await base44.auth.me().catch(() => null);
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const action = body.action || 'process_mailbox';

    switch (action) {
      // Process all unprocessed mailbox messages and extract codes/links
      case 'process_mailbox': {
        const { identity_id, email_address } = body;
        
        const results = {
          emails_processed: 0,
          codes_extracted: 0,
          links_extracted: 0,
          accounts_completed: 0,
          errors: [],
          processed_messages: []
        };

        // Step 1: Fetch InPlatformEmail records
        let emails = [];
        if (email_address) {
          emails = await base44.asServiceRole.entities.InPlatformEmail.filter(
            { email_address, is_active: true },
            '-last_message_at',
            10
          ).catch(() => []);
        } else if (identity_id) {
          emails = await base44.asServiceRole.entities.InPlatformEmail.filter(
            { identity_id, is_active: true },
            '-last_message_at',
            10
          ).catch(() => []);
        } else {
          // Get all active in-platform emails
          emails = await base44.asServiceRole.entities.InPlatformEmail.filter(
            { is_active: true },
            '-last_message_at',
            50
          ).catch(() => []);
        }

        if (!Array.isArray(emails)) emails = [];

        // Step 2: Process each email's messages
        for (const emailRecord of emails) {
          if (!emailRecord || !emailRecord.id) continue;

          const messages = Array.isArray(emailRecord.messages) ? emailRecord.messages : [];
          let codesExtracted = 0;
          let linksExtracted = 0;

          for (const msg of messages) {
            if (!msg || msg.processed) continue;

            try {
              // Step 3: Parse message with LLM
              const parseRes = await base44.asServiceRole.integrations.Core.InvokeLLM({
                prompt: `Extract verification codes and confirmation links from this email. Return JSON with fields: code (6-8 digit or alphanumeric code), link (full URL starting with http), confirm_type (email_verification, sms_verification, account_confirmation, password_reset, etc.).
                
Email:
From: ${msg.from || 'unknown'}
Subject: ${msg.subject || ''}
Body:
${msg.full_body || msg.body_preview || ''}

Only return valid, complete information. If no code or link found, return null for that field.`,
                response_json_schema: {
                  type: 'object',
                  properties: {
                    code: { type: ['string', 'null'] },
                    link: { type: ['string', 'null'] },
                    confirm_type: { type: ['string', 'null'] }
                  }
                }
              });

              const parsed = parseRes.code || parseRes.data;
              if (!parsed) {
                console.log(`[MailboxEngine] No extraction result for message ${msg.message_id}`);
                continue;
              }

              // Update message with extracted data
              msg.verification_code = parsed.code || null;
              msg.confirmation_link = parsed.link || null;
              msg.processed = true;

              if (parsed.code) codesExtracted++;
              if (parsed.link) linksExtracted++;

              // Step 4: Update InPlatformEmail record
              const updatedMessages = emailRecord.messages.map(m =>
                m.message_id === msg.message_id ? msg : m
              );

              await base44.asServiceRole.entities.InPlatformEmail.update(emailRecord.id, {
                messages: updatedMessages,
                extracted_verification_code: parsed.code || emailRecord.extracted_verification_code,
                extracted_confirmation_link: parsed.link || emailRecord.extracted_confirmation_link,
                verification_status: parsed.code ? 'code_received' : (parsed.link ? 'link_received' : emailRecord.verification_status),
                total_messages: (emailRecord.total_messages || 0) + 1,
                unread_count: Math.max(0, (emailRecord.unread_count || 0) - 1)
              });

              results.processed_messages.push({
                message_id: msg.message_id,
                from: msg.from,
                subject: msg.subject,
                code_extracted: !!parsed.code,
                link_extracted: !!parsed.link,
                confirm_type: parsed.confirm_type
              });

            } catch (e) {
              results.errors.push(`Message parse failed ${msg.message_id}: ${e.message}`);
              console.error(`[MailboxEngine] Message parse error:`, e.message);
            }
          }

          if (codesExtracted > 0 || linksExtracted > 0) {
            results.emails_processed++;
            results.codes_extracted += codesExtracted;
            results.links_extracted += linksExtracted;

            // Step 5: Sync to Identity Hub
            try {
              if (emailRecord.identity_id) {
                const identity = await base44.asServiceRole.entities.AIIdentity.get(
                  emailRecord.identity_id
                ).catch(() => null);

                if (identity) {
                  const updatedEmails = Array.isArray(identity.in_platform_emails)
                    ? identity.in_platform_emails.map(e =>
                        e.email_address === emailRecord.email_address
                          ? { ...e, verification_code: results.codes_extracted > 0, verification_link: results.links_extracted > 0 }
                          : e
                      )
                    : [{ email_address: emailRecord.email_address, verification_code: results.codes_extracted > 0 }];

                  await base44.asServiceRole.entities.AIIdentity.update(emailRecord.identity_id, {
                    in_platform_emails: updatedEmails
                  });
                }
              }
            } catch (e) {
              console.error(`[MailboxEngine] Identity sync failed:`, e.message);
            }

            // Step 6: Sync to Credential Vault
            try {
              const credVault = await base44.asServiceRole.entities.CredentialVault.filter(
                { email_address: emailRecord.email_address },
                '-created_date',
                1
              ).catch(() => []);

              if (credVault && credVault[0] && credVault[0].id) {
                await base44.asServiceRole.entities.CredentialVault.update(credVault[0].id, {
                  email_verified: results.codes_extracted > 0 || results.links_extracted > 0,
                  verification_date: results.codes_extracted > 0 || results.links_extracted > 0 ? new Date().toISOString() : null,
                  extracted_codes: [
                    ...(Array.isArray(credVault[0].extracted_codes) ? credVault[0].extracted_codes : []),
                    ...results.processed_messages
                      .filter(m => m.code_extracted)
                      .map(m => ({ code: m.message_id, from: m.from }))
                  ]
                });
                results.accounts_completed++;
              }
            } catch (e) {
              console.error(`[MailboxEngine] CredentialVault sync failed:`, e.message);
            }

            // Step 7: Trigger account creation workflow if linked
            try {
              if (emailRecord.linked_account_id) {
                const linkedAcc = await base44.asServiceRole.entities.LinkedAccountCreation.get(
                  emailRecord.linked_account_id
                ).catch(() => null);

                if (linkedAcc && (results.codes_extracted > 0 || results.links_extracted > 0)) {
                  await base44.asServiceRole.entities.LinkedAccountCreation.update(emailRecord.linked_account_id, {
                    status: 'verification_received',
                    verification_code_received: results.codes_extracted > 0,
                    confirmation_link_received: results.links_extracted > 0,
                    verification_date: new Date().toISOString()
                  });

                  // Trigger next step: complete account creation with actual extracted values
                  const extractedCode = results.processed_messages
                    .find(m => m.code_extracted)?.message_id || null;
                  const extractedLink = results.processed_messages
                    .find(m => m.link_extracted)?.message_id || null;

                  await base44.asServiceRole.functions.invoke('accountCreationEmailWorkflow', {
                    action: 'verify_account',
                    account_id: emailRecord.linked_account_id,
                    identity_id: emailRecord.identity_id,
                    email_address: emailRecord.email_address,
                    verification_code: extractedCode ? await getExtractedCode(base44, emailRecord.id, extractedCode) : null,
                    confirmation_link: extractedLink ? await getExtractedLink(base44, emailRecord.id, extractedLink) : null,
                    inbox_message_id: extractedCode || extractedLink
                  }).catch(e => console.error('Verification trigger failed:', e.message));
                }
              }
            } catch (e) {
              console.error(`[MailboxEngine] Workflow trigger failed:`, e.message);
            }
          }
        }

        // Activity log
        await base44.asServiceRole.entities.ActivityLog.create({
          action_type: 'system',
          message: `📧 Mailbox Engine: Processed ${results.emails_processed} mailboxes, extracted ${results.codes_extracted} codes + ${results.links_extracted} links`,
          severity: results.errors.length > 0 ? 'warning' : 'success',
          metadata: results
        }).catch(() => null);

        return Response.json({ success: true, ...results });
      }

      // Manually process a single email
      case 'process_email': {
        const { email_id, message_id } = body;

        if (!email_id) {
          return Response.json({ error: 'email_id required', status: 400 });
        }

        const emailRecord = await base44.asServiceRole.entities.InPlatformEmail.get(email_id).catch(() => null);
        if (!emailRecord) {
          return Response.json({ error: 'Email not found', status: 404 });
        }

        const messages = Array.isArray(emailRecord.messages) ? emailRecord.messages : [];
        const targetMsg = message_id
          ? messages.find(m => m.message_id === message_id)
          : messages.find(m => !m.processed);

        if (!targetMsg) {
          return Response.json({ error: 'Message not found or already processed', status: 404 });
        }

        // Parse and extract
        const parseRes = await base44.asServiceRole.integrations.Core.InvokeLLM({
          prompt: `Extract verification codes and confirmation links from this email:\n\nFrom: ${targetMsg.from}\nSubject: ${targetMsg.subject}\nBody: ${targetMsg.full_body || targetMsg.body_preview}`,
          response_json_schema: {
            type: 'object',
            properties: {
              code: { type: ['string', 'null'] },
              link: { type: ['string', 'null'] },
              confirm_type: { type: ['string', 'null'] }
            }
          }
        });

        const parsed = parseRes.code || parseRes.data;
        targetMsg.verification_code = parsed?.code || null;
        targetMsg.confirmation_link = parsed?.link || null;
        targetMsg.processed = true;

        await base44.asServiceRole.entities.InPlatformEmail.update(email_id, {
          messages,
          extracted_verification_code: parsed?.code,
          extracted_confirmation_link: parsed?.link,
          verification_status: parsed?.code ? 'code_received' : (parsed?.link ? 'link_received' : 'pending')
        });

        return Response.json({
          success: true,
          message_id: targetMsg.message_id,
          code: targetMsg.verification_code,
          link: targetMsg.confirmation_link,
          confirm_type: parsed?.confirm_type
        });
      }

      default:
        return Response.json({ error: `Unknown action: ${action}` }, { status: 400 });
    }
  } catch (error) {
    console.error('[AutopilotMailboxEngine]', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});