import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

/**
 * KYC Consolidation Trigger
 * Automatically runs on user login to consolidate scattered KYC data
 * Called by auth context or dashboard initialization
 */

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    // Check if this user has already been consolidated
    const lastConsolidation = await base44.entities.ActivityLog.filter(
      {
        action_type: 'system',
        metadata: { event: 'kyc_consolidation', user: user.email }
      },
      '-created_date',
      1
    ).catch(() => []);

    if (lastConsolidation.length > 0) {
      // Already consolidated, skip
      return Response.json({ success: true, already_consolidated: true });
    }

    // Run consolidation
    const result = await base44.functions.invoke('kycDataConsolidation', {
      action: 'consolidate_user_kyc'
    });

    return Response.json({ 
      success: result.data.success, 
      report: result.data.report,
      triggered: true 
    });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});