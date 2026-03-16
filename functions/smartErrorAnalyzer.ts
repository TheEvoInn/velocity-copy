import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { task_id, error_message, http_status, platform, execution_log } = await req.json();

    if (!task_id) {
      return Response.json({ error: 'Missing task_id' }, { status: 400 });
    }

    // Analyze error
    const analysis = analyzeError(error_message, http_status, platform, execution_log);

    // Determine recoverability
    const { is_recoverable, recovery_strategy, confidence } = determineRecovery(analysis);

    // Calculate optimal delay
    const { delay_seconds, delay_reason } = calculateOptimalDelay(
      analysis.error_type,
      platform,
      execution_log
    );

    // Get historical success rate for this error type/platform combo
    const success_rate = await getHistoricalSuccessRate(base44, platform, analysis.error_type);

    const result = {
      task_id,
      error_type: analysis.error_type,
      error_category: analysis.category,
      error_details: analysis.details,
      is_recoverable,
      recovery_strategy,
      confidence_score: confidence,
      calculated_delay_seconds: delay_seconds,
      delay_reason,
      historical_success_rate: success_rate,
      requires_identity_switch: analysis.requires_identity_switch,
      requires_account_switch: analysis.requires_account_switch,
      requires_credential_refresh: analysis.requires_credential_refresh,
      requires_form_rebuild: analysis.requires_form_rebuild,
      requires_user_input: analysis.requires_user_input,
      timestamp: new Date().toISOString(),
    };

    return Response.json(result);
  } catch (error) {
    console.error('Error analysis failed:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});

function analyzeError(errorMessage, httpStatus, platform, executionLog = []) {
  const msg = (errorMessage || '').toLowerCase();
  const logs = executionLog || [];

  let errorType = 'unknown';
  let category = 'unknown';
  let details = {};
  let requires_identity_switch = false;
  let requires_account_switch = false;
  let requires_credential_refresh = false;
  let requires_form_rebuild = false;
  let requires_user_input = false;

  // Rate limit detection
  if (httpStatus === 429 || msg.includes('rate limit') || msg.includes('too many requests')) {
    errorType = 'rate_limit';
    category = 'temporary_platform_issue';
    requires_credential_refresh = false;
  }
  // Captcha detection
  else if (msg.includes('captcha') || msg.includes('bot detection') || msg.includes('verify you are human')) {
    errorType = 'captcha';
    category = 'user_required_action';
    requires_user_input = true;
  }
  // Session/Auth errors
  else if (httpStatus === 401 || httpStatus === 403 || msg.includes('unauthorized') || msg.includes('session expired')) {
    errorType = 'session_expired';
    category = 'invalid_credentials';
    requires_credential_refresh = true;
  }
  // Identity mismatch
  else if (msg.includes('identity mismatch') || msg.includes('account mismatch') || msg.includes('verification failed')) {
    errorType = 'identity_mismatch';
    category = 'identity_mismatch';
    requires_identity_switch = true;
  }
  // Network issues
  else if (msg.includes('timeout') || msg.includes('connection reset') || msg.includes('no such host')) {
    errorType = 'network_timeout';
    category = 'temporary_platform_issue';
  }
  // Platform downtime
  else if (httpStatus === 503 || msg.includes('service unavailable') || msg.includes('maintenance')) {
    errorType = 'platform_downtime';
    category = 'platform_maintenance';
  }
  // Form parsing failure
  else if (msg.includes('form') || msg.includes('field') || msg.includes('input') || msg.includes('parse')) {
    errorType = 'form_parsing_error';
    category = 'form_parsing_failure';
    requires_form_rebuild = true;
  }
  // Missing credentials
  else if (msg.includes('missing') && (msg.includes('credential') || msg.includes('api key') || msg.includes('token'))) {
    errorType = 'invalid_credentials';
    category = 'invalid_credentials';
    requires_credential_refresh = true;
  }
  // Missing account
  else if (msg.includes('account not found') || msg.includes('no such account')) {
    errorType = 'missing_account';
    category = 'missing_identity_or_account';
    requires_account_switch = true;
  }
  // Permanent rejection
  else if (httpStatus === 400 || msg.includes('invalid') && msg.includes('permanently')) {
    errorType = 'permanent_rejection';
    category = 'permanent_rejection';
  }

  return {
    error_type: errorType,
    category,
    details: {
      message: errorMessage,
      http_status: httpStatus,
      platform,
    },
    requires_identity_switch,
    requires_account_switch,
    requires_credential_refresh,
    requires_form_rebuild,
    requires_user_input,
  };
}

function determineRecovery(analysis) {
  const { error_type, category, requires_identity_switch, requires_credential_refresh } = analysis;

  let is_recoverable = true;
  let recovery_strategy = 'simple_retry';
  let confidence = 50;

  switch (error_type) {
    case 'rate_limit':
      recovery_strategy = 'retry_with_delay';
      is_recoverable = true;
      confidence = 85;
      break;
    case 'captcha':
      recovery_strategy = 'user_input_required';
      is_recoverable = false;
      confidence = 0;
      break;
    case 'session_expired':
      recovery_strategy = 'refresh_credentials';
      is_recoverable = true;
      confidence = 80;
      break;
    case 'identity_mismatch':
      recovery_strategy = 'switch_identity';
      is_recoverable = true;
      confidence = 70;
      break;
    case 'network_timeout':
      recovery_strategy = 'retry_with_delay';
      is_recoverable = true;
      confidence = 65;
      break;
    case 'platform_downtime':
      recovery_strategy = 'wait_for_uptime';
      is_recoverable = true;
      confidence = 75;
      break;
    case 'form_parsing_error':
      recovery_strategy = 'rebuild_form_mapping';
      is_recoverable = true;
      confidence = 60;
      break;
    case 'invalid_credentials':
      recovery_strategy = 'refresh_credentials';
      is_recoverable = true;
      confidence = 75;
      break;
    case 'missing_account':
      recovery_strategy = 'switch_account';
      is_recoverable = true;
      confidence = 70;
      break;
    case 'permanent_rejection':
      recovery_strategy = 'escalate';
      is_recoverable = false;
      confidence = 5;
      break;
    default:
      recovery_strategy = 'simple_retry';
      is_recoverable = true;
      confidence = 30;
  }

  return { is_recoverable, recovery_strategy, confidence };
}

function calculateOptimalDelay(errorType, platform, executionLog = []) {
  let delay_seconds = 0;
  let delay_reason = '';

  switch (errorType) {
    case 'rate_limit':
      delay_seconds = 300 + Math.random() * 1200; // 5-25 minutes
      delay_reason = 'Rate limit detected - waiting for cooldown window';
      break;
    case 'captcha':
      delay_seconds = 3600; // 1 hour
      delay_reason = 'Captcha detected - waiting before retry';
      break;
    case 'session_expired':
      delay_seconds = 30 + Math.random() * 30; // 30-60 seconds
      delay_reason = 'Session expired - refreshing after brief delay';
      break;
    case 'network_timeout':
      delay_seconds = 30 + Math.random() * 60; // 30-90 seconds
      delay_reason = 'Network instability detected - waiting for stabilization';
      break;
    case 'platform_downtime':
      delay_seconds = 900; // 15 minutes
      delay_reason = 'Platform maintenance detected - waiting for uptime';
      break;
    case 'form_parsing_error':
      delay_seconds = 60; // 1 minute
      delay_reason = 'Form structure changed - waiting before retry';
      break;
    case 'identity_mismatch':
      delay_seconds = 120; // 2 minutes
      delay_reason = 'Identity mismatch - switching identity';
      break;
    case 'invalid_credentials':
      delay_seconds = 60; // 1 minute
      delay_reason = 'Credentials refreshed - retrying with new auth';
      break;
    case 'missing_account':
      delay_seconds = 300; // 5 minutes
      delay_reason = 'Switching to alternative account';
      break;
    default:
      delay_seconds = 60;
      delay_reason = 'Standard retry delay';
  }

  // Platform-specific adjustments
  if (platform === 'upwork') {
    delay_seconds *= 1.5; // Upwork is stricter
  } else if (platform === 'fiverr') {
    delay_seconds *= 1.2; // Fiverr has moderate limits
  }

  return { delay_seconds: Math.round(delay_seconds), delay_reason };
}

async function getHistoricalSuccessRate(base44, platform, errorType) {
  try {
    const histories = await base44.entities.RetryHistory.filter(
      { platform, error_type: errorType, status: 'completed' },
      '-created_date',
      100
    );

    if (!histories || histories.length === 0) {
      return 50; // Default confidence if no history
    }

    const successful = histories.filter(h => h.final_outcome === 'success').length;
    return Math.round((successful / histories.length) * 100);
  } catch (error) {
    console.error('Error fetching historical success rate:', error);
    return 50;
  }
}