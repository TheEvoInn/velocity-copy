import { base44 } from '@/api/base44Client';

/**
 * ACTUAL FIX: Wrap entity mutations to log ALL changes to ActivityLog
 * Since automations don't trigger reliably, we log directly in mutation functions
 */

async function logMutation(entityName, entityId, mutationType, data = {}) {
  try {
    const eventId = `${entityName}_${entityId}_${mutationType}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    await base44.entities.ActivityLog.create({
      action_type: mutationType,
      message: `⟳ ${mutationType} ${entityName} #${entityId}`,
      severity: 'info',
      metadata: {
        entity_name: entityName,
        entity_id: entityId,
        mutation_type: mutationType,
        event_id: eventId,
        timestamp: new Date().toISOString()
      }
    }).catch(err => console.error('Log failed:', err));
  } catch (err) {
    console.error('Failed to log mutation:', err);
  }
}

/**
 * WRAPPED: Opportunity mutations
 */
export async function createOpportunityWithLog(data) {
  const result = await base44.entities.Opportunity.create(data);
  if (result?.id) {
    logMutation('Opportunity', result.id, 'create', result);
  }
  return result;
}

export async function updateOpportunityWithLog(id, data) {
  const result = await base44.entities.Opportunity.update(id, data);
  if (result) {
    logMutation('Opportunity', id, 'update', data);
  }
  return result;
}

export async function deleteOpportunityWithLog(id) {
  await base44.entities.Opportunity.delete(id);
  logMutation('Opportunity', id, 'delete');
}

/**
 * WRAPPED: TaskExecutionQueue mutations
 */
export async function createTaskWithLog(data) {
  const result = await base44.entities.TaskExecutionQueue.create(data);
  if (result?.id) {
    logMutation('TaskExecutionQueue', result.id, 'create', result);
  }
  return result;
}

export async function updateTaskWithLog(id, data) {
  const result = await base44.entities.TaskExecutionQueue.update(id, data);
  if (result) {
    logMutation('TaskExecutionQueue', id, 'update', data);
  }
  return result;
}

/**
 * WRAPPED: UserGoals mutations
 */
export async function updateUserGoalsWithLog(id, data) {
  const result = await base44.entities.UserGoals.update(id, data);
  if (result) {
    logMutation('UserGoals', id, 'update', data);
  }
  return result;
}

/**
 * WRAPPED: AIIdentity mutations
 */
export async function updateAIIdentityWithLog(id, data) {
  const result = await base44.entities.AIIdentity.update(id, data);
  if (result) {
    logMutation('AIIdentity', id, 'update', data);
  }
  return result;
}

/**
 * WRAPPED: Transaction mutations
 */
export async function createTransactionWithLog(data) {
  const result = await base44.entities.Transaction.create(data);
  if (result?.id) {
    logMutation('Transaction', result.id, 'create', result);
  }
  return result;
}