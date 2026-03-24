import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

/**
 * API EXECUTION NOTIFIER
 * Sends notifications on API execution success/failure
 * Integrates with NotificationCenter & NotificationOrchestrator
 */

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { action, execution_result, task_id, api_id } = await req.json();

    if (action === 'notify_execution') {
      return await notifyExecution(base44, user, execution_result, task_id, api_id);
    } else if (action === 'send_daily_summary') {
      return await sendDailySummary(base44);
    } else if (action === 'send_alert') {
      return await sendAlert(base44, execution_result);
    } else {
      return Response.json({ error: 'Unknown action' }, { status: 400 });
    }
  } catch (error) {
    console.error('[apiExecutionNotifier]', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});

/**
 * Notify user of API execution result
 */
async function notifyExecution(base44, user, executionResult, taskId, apiId) {
  const { success, status_code, response_time_ms, error, api_name } = executionResult;

  // Determine notification type and message
  const isSuccess = success && status_code < 400;
  const notificationType = isSuccess ? 'execution_success' : 'execution_failure';
  const severity = isSuccess ? 'info' : 'warning';

  const message = isSuccess
    ? `✅ API execution successful: ${api_name} completed in ${response_time_ms}ms`
    : `❌ API execution failed: ${api_name} returned ${status_code} — ${error || 'Unknown error'}`;

  // Create notification record
  const notification = await base44.entities.Notification?.create?.({
    user_email: user.email,
    type: notificationType,
    severity,
    title: isSuccess ? 'API Execution Success' : 'API Execution Failed',
    message,
    icon: isSuccess ? 'check-circle' : 'alert-circle',
    related_entity: 'api_execution',
    related_id: taskId,
    api_id: apiId,
    read: false,
    created_at: new Date().toISOString(),
  }).catch(() => null);

  // Send email if user preferences allow
  try {
    const userGoals = await base44.entities.UserGoals.list('-created_date', 1);
    const prefs = userGoals[0];
    
    const shouldEmailSuccess = prefs?.notify_email_completion !== false;
    const shouldEmailError = prefs?.notify_email_errors !== false;

    if ((isSuccess && shouldEmailSuccess) || (!isSuccess && shouldEmailError)) {
      await base44.integrations.Core.SendEmail({
        to: user.email,
        subject: `${isSuccess ? '✅' : '❌'} API Execution Update: ${api_name}`,
        body: `
${message}

Task ID: ${taskId}
API: ${api_name}
Response Time: ${response_time_ms}ms
Status Code: ${status_code}

${isSuccess ? 'Great! Your API execution completed successfully.' : `Error: ${error}`}

View details: [Dashboard Link]
        `,
      });
    }
  } catch (error) {
    console.warn('Email notification failed:', error.message);
  }

  // Log notification event
  await base44.entities.APIDiscoveryLog.create({
    api_id: apiId,
    api_name,
    action_type: 'used_by_autopilot',
    status: isSuccess ? 'success' : 'failed',
    details: {
      notification_sent: true,
      user_email: user.email,
    },
    timestamp: new Date().toISOString(),
  }).catch(() => null);

  return Response.json({
    success: true,
    notification_id: notification?.id,
    user_notified: true,
    notification_type: notificationType,
  });
}

/**
 * Send daily API execution summary
 */
async function sendDailySummary(base44) {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const startOfDay = new Date(yesterday).setHours(0, 0, 0, 0);

  // Fetch execution logs from yesterday
  const logs = await base44.entities.APIDiscoveryLog.filter({
    action_type: 'used_by_autopilot',
  }, '-created_date', 100);

  const successCount = logs.filter(l => l.status === 'success').length;
  const failureCount = logs.filter(l => l.status === 'failed').length;
  const totalCost = logs.reduce((sum, l) => sum + (l.details?.cost || 0), 0);

  const users = await base44.entities.User.list('-created_date', 100);

  for (const user of users) {
    try {
      await base44.integrations.Core.SendEmail({
        to: user.email,
        subject: `📊 Daily API Execution Summary — ${new Date(yesterday).toLocaleDateString()}`,
        body: `
Daily API Execution Report

Total Executions: ${successCount + failureCount}
✅ Successful: ${successCount}
❌ Failed: ${failureCount}
💰 Total Cost: $${totalCost.toFixed(2)}
Success Rate: ${successCount + failureCount > 0 ? ((successCount / (successCount + failureCount)) * 100).toFixed(1) : 0}%

Top Performing APIs: [Data link]
Failed APIs: [Data link]
Cost Breakdown: [Data link]

Dashboard: [Link]
        `,
      });
    } catch (error) {
      console.warn(`Daily summary email failed for ${user.email}:`, error.message);
    }
  }

  return Response.json({
    success: true,
    executions_logged: logs.length,
    successful: successCount,
    failed: failureCount,
    emails_sent: users.length,
  });
}

/**
 * Send alert on critical failure
 */
async function sendAlert(base44, executionResult) {
  const { api_name, error, status_code } = executionResult;

  // Determine if critical
  const isCritical = status_code >= 500 || error?.includes('timeout') || error?.includes('connection');

  if (!isCritical) return Response.json({ success: true, alert_sent: false });

  // Get admin users
  const admins = await base44.entities.User?.list?.('-created_date', 100);
  const adminUsers = admins?.filter(u => u.role === 'admin') || [];

  for (const admin of adminUsers) {
    try {
      await base44.integrations.Core.SendEmail({
        to: admin.email,
        subject: `🚨 CRITICAL: API Execution Failure — ${api_name}`,
        body: `
Critical API Execution Failure

API: ${api_name}
Status: ${status_code}
Error: ${error}
Time: ${new Date().toISOString()}

Immediate Action Required:
- Check API health status
- Verify credentials
- Review error logs
- Consider fallback strategy

Admin Dashboard: [Link]
        `,
      });
    } catch (error) {
      console.warn(`Critical alert email failed for ${admin.email}:`, error.message);
    }
  }

  return Response.json({
    success: true,
    alert_sent: true,
    admins_notified: adminUsers.length,
  });
}