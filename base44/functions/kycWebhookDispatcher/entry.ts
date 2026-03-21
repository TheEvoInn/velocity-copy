import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

/**
 * kycWebhookDispatcher
 * Triggered by entity automation on KYC update.
 * Looks up the KYC owner's UserDataStore for a webhook URL,
 * and POSTs a payload with status change details.
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();

    const { event, data, old_data } = body;

    // Only fire on actual status changes
    if (!data || !old_data) {
      return Response.json({ skipped: true, reason: 'missing data or old_data' });
    }

    const statusChanged = data.status !== old_data.status;
    const adminStatusChanged = data.admin_status !== old_data.admin_status;

    if (!statusChanged && !adminStatusChanged) {
      return Response.json({ skipped: true, reason: 'no status change' });
    }

    // Find the KYC owner's email via created_by
    const ownerEmail = data.created_by;
    if (!ownerEmail) {
      return Response.json({ skipped: true, reason: 'no owner email' });
    }

    // Look up their UserDataStore for webhook config (service role to bypass RLS)
    const stores = await base44.asServiceRole.entities.UserDataStore.filter({ user_email: ownerEmail });
    const store = stores[0];

    if (!store || !store.kyc_webhook_enabled || !store.kyc_webhook_url) {
      return Response.json({ skipped: true, reason: 'no webhook configured' });
    }

    const webhookUrl = store.kyc_webhook_url;
    const webhookSecret = store.kyc_webhook_secret || '';

    // Build payload
    const payload = {
      event: 'kyc.status_changed',
      timestamp: new Date().toISOString(),
      kyc_id: data.id,
      owner_email: ownerEmail,
      previous_status: old_data.status,
      new_status: data.status,
      previous_admin_status: old_data.admin_status,
      new_admin_status: data.admin_status,
      verification_type: data.verification_type,
      full_legal_name: data.full_legal_name,
      user_approved_for_autopilot: data.user_approved_for_autopilot,
      doc_approvals: data.doc_approvals || {},
    };

    // Send webhook with timeout
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    const headers = {
      'Content-Type': 'application/json',
      'User-Agent': 'ProfitEngine-KYC-Webhook/1.0',
    };
    if (webhookSecret) {
      headers['X-Webhook-Secret'] = webhookSecret;
    }

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    console.log(`Webhook dispatched to ${webhookUrl} — status: ${response.status}`);

    return Response.json({
      success: true,
      webhook_status: response.status,
      kyc_id: data.id,
      status_transition: `${old_data.status} → ${data.status}`,
    });
  } catch (error) {
    console.error('Webhook dispatch error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});