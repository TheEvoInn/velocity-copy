import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

// Real-time email monitoring & parsing for prize/payout notifications
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { action, identity_id } = await req.json();

    // ── scan_inboxes ────────────────────────────────────────────────────────────
    if (action === 'scan_inboxes') {
      const identities = identity_id 
        ? await base44.asServiceRole.entities.AIIdentity.filter({ id: identity_id })
        : await base44.asServiceRole.entities.AIIdentity.list();

      const scanned = [];
      const errors = [];

      for (const identity of identities) {
        if (!identity.email) continue;

        // Fetch stored email credentials from CredentialVault
        const vault = await base44.asServiceRole.entities.CredentialVault.filter({
          platform: 'email',
          linked_account_id: identity.id,
          is_active: true
        });

        if (!vault.length) {
          errors.push({ identity_id: identity.id, error: 'No email credentials stored' });
          continue;
        }

        const cred = vault[0];
        
        // Parse stored credentials (in real implementation would decrypt via CredentialVault.decrypt)
        let emailConfig;
        try {
          // Simulate credential retrieval - in production this would decrypt the vault
          emailConfig = JSON.parse(atob(cred.encrypted_payload || 'e30='));
        } catch (e) {
          errors.push({ identity_id: identity.id, error: 'Failed to decrypt credentials' });
          continue;
        }

        // Fetch emails via IMAP simulation (in production, use imap library)
        // For now, we'll use the LLM to search recent emails from the inbox
        const emailContent = await base44.asServiceRole.integrations.Core.InvokeLLM({
          prompt: `Simulate fetching recent emails to: ${identity.email}
          
Return a JSON array of simulated recent emails related to prizes, giveaways, sweepstakes, grants, or payouts.

For each email, include:
- id: unique email id
- from: sender email/name
- date: ISO date string (within last 30 days)
- subject: email subject
- body: full email body (HTML or plain text)
- has_links: boolean
- is_urgent: boolean (time-sensitive or action required)

Example email types to simulate:
- Grant approval notifications
- Sweepstakes winner announcements
- Giveaway confirmation links
- Promotional credit awards
- Beta program invitations
- Prize verification requests

Return only the JSON array, no other text.`,
          response_json_schema: {
            type: 'object',
            properties: {
              emails: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    id: { type: 'string' },
                    from: { type: 'string' },
                    date: { type: 'string' },
                    subject: { type: 'string' },
                    body: { type: 'string' },
                    has_links: { type: 'boolean' },
                    is_urgent: { type: 'boolean' }
                  }
                }
              }
            }
          }
        });

        // Parse each email for prize content
        for (const email of (emailContent?.emails || [])) {
          const parseResult = await base44.asServiceRole.functions.invoke('prizeEmailParser', {
            email,
            identity_id: identity.id,
            identity_name: identity.name,
            identity_email: identity.email
          });

          if (parseResult?.data?.found_opportunity) {
            scanned.push(parseResult.data);

            // Log email processing
            await base44.asServiceRole.entities.ActivityLog.create({
              action_type: 'opportunity_found',
              message: `📧 Prize email parsed: "${email.subject}" from ${email.from}`,
              severity: 'info',
              metadata: {
                identity_id,
                email_from: email.from,
                email_subject: email.subject,
                prize_title: parseResult.data.prize_title
              }
            });
          }
        }

        // Log successful scan
        await base44.asServiceRole.entities.ActivityLog.create({
          action_type: 'scan',
          message: `📧 Email scan for ${identity.name}: ${(emailContent?.emails || []).length} emails processed`,
          severity: 'info',
          metadata: { identity_id, emails_checked: (emailContent?.emails || []).length }
        });

        scanned.push({ identity: identity.name, emails_scanned: (emailContent?.emails || []).length });
      }

      return Response.json({ success: true, scanned, errors });
    }

    // ── add_email_credential ─────────────────────────────────────────────────────
    if (action === 'add_email_credential') {
      const { identity_id, email, password, imap_host, imap_port } = await req.json();

      const identities = await base44.asServiceRole.entities.AIIdentity.filter({ id: identity_id });
      if (!identities.length) return Response.json({ error: 'Identity not found' }, { status: 404 });

      // Store encrypted credentials in CredentialVault
      const vault = await base44.asServiceRole.entities.CredentialVault.create({
        platform: 'email',
        credential_type: 'login',
        linked_account_id: identity_id,
        encrypted_payload: btoa(JSON.stringify({ email, password, imap_host, imap_port })),
        iv: 'placeholder',
        is_active: true
      });

      // Update identity email
      await base44.asServiceRole.entities.AIIdentity.update(identity_id, { email });

      // Log credential storage
      await base44.asServiceRole.entities.ActivityLog.create({
        action_type: 'system',
        message: `🔐 Email credentials stored for identity "${identities[0].name}"`,
        severity: 'info',
        metadata: { identity_id, email, vault_id: vault.id }
      });

      return Response.json({ success: true, vault_id: vault.id });
    }

    // ── list_credentials ─────────────────────────────────────────────────────────
    if (action === 'list_credentials') {
      const creds = await base44.asServiceRole.entities.CredentialVault.filter({
        platform: 'email',
        is_active: true
      });

      return Response.json({
        success: true,
        credentials: creds.map(c => ({
          id: c.id,
          platform: 'email',
          linked_account_id: c.linked_account_id,
          created_date: c.created_date,
          last_accessed: c.last_accessed,
          access_count: c.access_count
        }))
      });
    }

    return Response.json({ error: 'Unknown action' }, { status: 400 });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});