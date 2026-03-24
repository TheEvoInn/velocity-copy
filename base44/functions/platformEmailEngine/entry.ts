/**
 * PLATFORM EMAIL ENGINE
 * Manages in-platform virtual email addresses for Autopilot account creation.
 * When Autopilot creates an account on a 3rd-party platform, it uses these
 * virtual addresses to receive verification emails, extract codes/links,
 * and complete email confirmation automatically.
 *
 * Flow: create_email → account signup uses this email → receive_message (called by webhook or polling)
 *       → extract_verification → mark_verified → sync back to account
 */

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const { action } = body;

    // ── create_email ───────────────────────────────────────────────────────────
    if (action === 'create_email') {
      const { identity_id, platform, linked_account_id } = body;

      if (!identity_id) return Response.json({ error: 'identity_id required' }, { status: 400 });

      // Check if email already exists for this identity+platform
      const existing = await base44.asServiceRole.entities.InPlatformEmail.filter({
        identity_id,
        linked_platform: platform || '',
        is_active: true
      }, null, 1).catch(() => []);

      if (existing.length > 0) {
        return Response.json({
          success: true,
          already_exists: true,
          email: existing[0]
        });
      }

      // Generate unique email address
      const identities = await base44.asServiceRole.entities.AIIdentity.filter(
        { id: identity_id }, null, 1
      ).catch(() => []);
      const identity = identities[0];

      const namePart = (identity?.name || 'user').toLowerCase()
        .replace(/\s+/g, '').replace(/[^a-z0-9]/g, '').substring(0, 12);
      const uniqueSuffix = Math.random().toString(36).substring(2, 8);
      const emailAddress = `${namePart}_${uniqueSuffix}@velocity.mail`;

      const emailRecord = await base44.asServiceRole.entities.InPlatformEmail.create({
        email_address: emailAddress,
        identity_id,
        identity_name: identity?.name || 'Unknown',
        is_active: true,
        purpose: 'account_verification',
        linked_platform: platform || '',
        linked_account_id: linked_account_id || '',
        messages: [],
        total_messages: 0,
        unread_count: 0,
        verification_status: 'pending',
        created_by: user.email
      });

      // Log creation
      await base44.asServiceRole.entities.ActivityLog.create({
        action_type: 'system',
        message: `📧 In-platform email created: ${emailAddress} for ${platform || 'general use'}`,
        severity: 'info',
        metadata: { identity_id, platform, email_address: emailAddress }
      }).catch(() => null);

      return Response.json({
        success: true,
        email: emailRecord,
        email_address: emailAddress
      });
    }

    // ── get_inbox ──────────────────────────────────────────────────────────────
    if (action === 'get_inbox') {
      const { email_id, identity_id } = body;

      let emailRecord;
      if (email_id) {
        const results = await base44.asServiceRole.entities.InPlatformEmail.filter(
          { id: email_id }, null, 1
        ).catch(() => []);
        emailRecord = results[0];
      } else if (identity_id) {
        const results = await base44.asServiceRole.entities.InPlatformEmail.filter(
          { identity_id, is_active: true }, '-created_date', 10
        ).catch(() => []);
        return Response.json({ success: true, emails: results });
      }

      if (!emailRecord) return Response.json({ error: 'Email not found' }, { status: 404 });

      return Response.json({
        success: true,
        email_address: emailRecord.email_address,
        messages: emailRecord.messages || [],
        unread_count: emailRecord.unread_count || 0,
        verification_status: emailRecord.verification_status,
        extracted_code: emailRecord.extracted_verification_code,
        extracted_link: emailRecord.extracted_confirmation_link
      });
    }

    // ── receive_message ────────────────────────────────────────────────────────
    // Called when an email arrives (can be triggered by webhook or manual simulation)
    if (action === 'receive_message') {
      const { email_address, from, subject, body: emailBody } = body;

      if (!email_address || !emailBody) {
        return Response.json({ error: 'email_address and body required' }, { status: 400 });
      }

      // Find the email record
      const records = await base44.asServiceRole.entities.InPlatformEmail.filter(
        { email_address }, null, 1
      ).catch(() => []);

      if (!records.length) {
        return Response.json({ error: 'Email address not found' }, { status: 404 });
      }

      const record = records[0];
      const messageId = Math.random().toString(36).substring(2, 10);

      // Use LLM to extract verification code / confirmation link
      const extraction = await base44.asServiceRole.integrations.Core.InvokeLLM({
        prompt: `Extract verification/confirmation data from this email.

Subject: ${subject || ''}
Body: ${emailBody.substring(0, 2000)}

Return JSON with:
- verification_code: the numeric or alphanumeric verification/OTP code if present (null otherwise)  
- confirmation_link: the full URL to click for email confirmation if present (null otherwise)
- is_verification_email: boolean — true if this looks like an account verification email`,
        response_json_schema: {
          type: 'object',
          properties: {
            verification_code: { type: 'string' },
            confirmation_link: { type: 'string' },
            is_verification_email: { type: 'boolean' }
          }
        }
      }).catch(() => ({ verification_code: null, confirmation_link: null, is_verification_email: false }));

      const newMessage = {
        message_id: messageId,
        from: from || 'unknown@sender.com',
        subject: subject || '(no subject)',
        body_preview: emailBody.substring(0, 200),
        full_body: emailBody,
        received_at: new Date().toISOString(),
        is_read: false,
        verification_code: extraction.verification_code || null,
        confirmation_link: extraction.confirmation_link || null,
        processed: !!(extraction.verification_code || extraction.confirmation_link)
      };

      const messages = [...(record.messages || []), newMessage];
      const updateData = {
        messages,
        total_messages: messages.length,
        unread_count: (record.unread_count || 0) + 1,
        last_message_at: new Date().toISOString()
      };

      // Update verification status and extracted data
      if (extraction.verification_code) {
        updateData.extracted_verification_code = extraction.verification_code;
        updateData.verification_status = 'code_received';
      }
      if (extraction.confirmation_link) {
        updateData.extracted_confirmation_link = extraction.confirmation_link;
        updateData.verification_status = 'link_received';
      }

      await base44.asServiceRole.entities.InPlatformEmail.update(record.id, updateData);

      // Notify user if verification data was found
      if (extraction.verification_code || extraction.confirmation_link) {
        await base44.asServiceRole.entities.Notification.create({
          type: 'autopilot_execution',
          severity: 'info',
          title: `📧 Verification email received`,
          message: `Platform: ${record.linked_platform || 'unknown'} — ${extraction.verification_code ? `Code: ${extraction.verification_code}` : 'Confirmation link extracted'}`,
          user_email: record.created_by,
          related_entity_type: 'InPlatformEmail',
          related_entity_id: record.id,
          action_type: 'none',
          is_read: false
        }).catch(() => null);
      }

      return Response.json({
        success: true,
        message_id: messageId,
        verification_code_extracted: extraction.verification_code || null,
        confirmation_link_extracted: extraction.confirmation_link || null,
        is_verification_email: extraction.is_verification_email
      });
    }

    // ── mark_verified ──────────────────────────────────────────────────────────
    if (action === 'mark_verified') {
      const { email_id } = body;
      if (!email_id) return Response.json({ error: 'email_id required' }, { status: 400 });

      await base44.asServiceRole.entities.InPlatformEmail.update(email_id, {
        verification_status: 'verified'
      });

      return Response.json({ success: true, status: 'verified' });
    }

    // ── get_all_emails ─────────────────────────────────────────────────────────
    if (action === 'get_all_emails') {
      const emails = await base44.entities.InPlatformEmail.filter(
        {}, '-created_date', 50
      ).catch(() => []);

      return Response.json({ success: true, emails, total: emails.length });
    }

    return Response.json({ error: 'Unknown action' }, { status: 400 });

  } catch (error) {
    console.error('[PlatformEmailEngine]', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});