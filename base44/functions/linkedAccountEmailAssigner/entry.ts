/**
 * LINKED ACCOUNT EMAIL ASSIGNER
 * Entity automation trigger — fires on LinkedAccount create/update.
 * Auto-assigns a unique @vel.ai address via platformEmailEngine if not already present.
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));

    const { event, data } = body;
    const entityId = event?.entity_id || data?.id;
    const eventType = event?.type;

    if (!entityId) {
      return Response.json({ skipped: true, reason: 'No entity_id in payload' });
    }

    // Only act on create (or update when inplatform_email is still missing)
    const linkedAccount = data || (await base44.asServiceRole.entities.LinkedAccount.filter(
      { id: entityId }, null, 1
    ).then(r => r[0]).catch(() => null));

    if (!linkedAccount) {
      return Response.json({ skipped: true, reason: 'LinkedAccount not found' });
    }

    // Already has an email assigned — skip
    if (linkedAccount.inplatform_email) {
      return Response.json({ skipped: true, reason: 'Email already assigned', email: linkedAccount.inplatform_email });
    }

    // Delegate to platformEmailEngine assign_to_linked_account
    const result = await base44.asServiceRole.functions.invoke('platformEmailEngine', {
      action: 'assign_to_linked_account',
      linked_account_id: entityId,
      identity_id: linkedAccount.identity_id || null,
      platform: linkedAccount.platform || '',
    });

    return Response.json({
      success: true,
      linked_account_id: entityId,
      email_address: result?.email_address,
      already_exists: result?.already_exists || false,
    });

  } catch (error) {
    console.error('[LinkedAccountEmailAssigner]', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});