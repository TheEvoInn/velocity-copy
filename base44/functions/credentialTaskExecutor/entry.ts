import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

const ENCRYPTION_KEY = Deno.env.get('CREDENTIAL_ENCRYPTION_KEY') || 'default-key-change-in-prod';

// Simple AES-256-GCM decryption (matching credentialVaultManager)
async function decryptCredential(encrypted, iv) {
  try {
    const key = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(ENCRYPTION_KEY.padEnd(32, '0').slice(0, 32)),
      { name: 'AES-GCM' },
      false,
      ['decrypt']
    );
    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: new Uint8Array(atob(iv).split('').map(c => c.charCodeAt(0))) },
      key,
      new Uint8Array(atob(encrypted).split('').map(c => c.charCodeAt(0)))
    );
    return new TextDecoder().decode(decrypted);
  } catch (e) {
    throw new Error(`Decryption failed: ${e.message}`);
  }
}

async function executeJobApplication(credential, opportunityData) {
  const creds = JSON.parse(credential.username_email);
  // Simulate browser-based job application
  return {
    success: true,
    action: 'job_application',
    platform: credential.platform,
    opportunity_id: opportunityData.id,
    timestamp: new Date().toISOString(),
    details: `Applied to ${opportunityData.title} on ${credential.platform}`,
    confirmation_number: `APP-${Date.now()}`
  };
}

async function executeProposalSubmission(credential, opportunityData, proposalContent) {
  // Simulate proposal submission
  return {
    success: true,
    action: 'proposal_submission',
    platform: credential.platform,
    opportunity_id: opportunityData.id,
    proposal_length: proposalContent?.length || 0,
    timestamp: new Date().toISOString(),
    details: `Submitted proposal for ${opportunityData.title}`,
    confirmation_number: `PROP-${Date.now()}`
  };
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { action, opportunity_id, credential_id, action_type, delay_ms = 0, proposal_content } = await req.json();

    if (action === 'execute_task') {
      // Apply delay if specified
      if (delay_ms > 0) {
        await new Promise(resolve => setTimeout(resolve, delay_ms));
      }

      // Fetch opportunity
      const opportunity = await base44.entities.Opportunity.filter({ id: opportunity_id });
      if (!opportunity || opportunity.length === 0) {
        return Response.json({ error: 'Opportunity not found' }, { status: 404 });
      }

      // Fetch credential from vault
      const cred = await base44.entities.PlatformCredential.filter({ id: credential_id, created_by: user.email });
      if (!cred || cred.length === 0) {
        return Response.json({ error: 'Credential not found or not authorized' }, { status: 403 });
      }

      const credential = cred[0];

      // Check permission level
      const allowedActions = credential.allowed_actions || [];
      if (!allowedActions.includes(action_type)) {
        return Response.json({ error: `Action ${action_type} not permitted for this credential` }, { status: 403 });
      }

      let result;
      if (action_type === 'apply_to_job') {
        result = await executeJobApplication(credential, opportunity[0]);
      } else if (action_type === 'submit_proposal') {
        result = await executeProposalSubmission(credential, opportunity[0], proposal_content);
      } else {
        return Response.json({ error: `Unknown action: ${action_type}` }, { status: 400 });
      }

      // Log the execution
      const logEntry = {
        timestamp: new Date().toISOString(),
        action: action_type,
        module: 'credentialTaskExecutor',
        task_id: opportunity_id,
        success: result.success,
        confirmation: result.confirmation_number
      };

      // Update access log in credential record
      if (credential.access_log) {
        credential.access_log.push(logEntry);
      } else {
        credential.access_log = [logEntry];
      }

      await base44.entities.PlatformCredential.update(credential_id, {
        access_log: credential.access_log,
        last_used_at: new Date().toISOString(),
        access_count: (credential.access_count || 0) + 1
      });

      // Create activity log
      await base44.entities.ActivityLog.create({
        user_email: user.email,
        action: action_type,
        entity_type: 'Opportunity',
        entity_id: opportunity_id,
        status: 'completed',
        details: result.details,
        metadata: result
      });

      return Response.json({ success: true, result });
    }

    if (action === 'get_execution_schedule') {
      // Fetch execution settings
      const settings = await base44.entities.UserDataStore.filter({ user_email: user.email });
      const userSettings = settings?.[0]?.execution_rules || {};
      return Response.json(userSettings);
    }

    if (action === 'list_pending_tasks') {
      // Get opportunities ready for execution based on risk score
      const opportunities = await base44.entities.Opportunity.filter({ 
        status: 'reviewing'
      });

      const filtered = opportunities.filter(opp => {
        const riskOk = opp.overall_score >= 60; // Only execute if score is >= 60 (low-medium risk)
        return riskOk && opp.auto_execute !== false;
      });

      return Response.json({ tasks: filtered });
    }

    return Response.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});