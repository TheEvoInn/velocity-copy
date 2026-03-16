import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

/**
 * Credential Interceptor
 * Intercepts all credential flows and routes them to secretManager
 * Used by: Autopilot, Agent Worker, Identity Manager, Account Creation Engine, Prize Module
 */

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { action, payload } = await req.json();

    if (action === 'on_account_created') {
      return await onAccountCreated(base44, user, payload);
    }

    if (action === 'on_oauth_token_received') {
      return await onOAuthTokenReceived(base44, user, payload);
    }

    if (action === 'on_password_generated') {
      return await onPasswordGenerated(base44, user, payload);
    }

    if (action === 'on_api_key_generated') {
      return await onAPIKeyGenerated(base44, user, payload);
    }

    if (action === 'on_session_established') {
      return await onSessionEstablished(base44, user, payload);
    }

    if (action === 'on_verification_code_received') {
      return await onVerificationCodeReceived(base44, user, payload);
    }

    if (action === 'on_email_created') {
      return await onEmailCreated(base44, user, payload);
    }

    if (action === 'on_user_credential_provided') {
      return await onUserCredentialProvided(base44, user, payload);
    }

    return Response.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error) {
    console.error('Credential Interceptor Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});

/**
 * Intercept account creation
 */
async function onAccountCreated(base44, user, payload) {
  const {
    identity_id,
    platform,
    username,
    email,
    password,
    module_source,
    task_id,
    opportunity_id
  } = payload;

  // Store username
  await storeCredential(base44, user, {
    secret_value: username,
    secret_name: `${platform}_username_${identity_id}`,
    secret_type: 'username',
    platform,
    identity_id,
    account_identifier: email || username,
    module_source,
    task_id,
    opportunity_id,
    rotation_frequency: 'never'
  });

  // Store password
  await storeCredential(base44, user, {
    secret_value: password,
    secret_name: `${platform}_password_${identity_id}`,
    secret_type: 'password',
    platform,
    identity_id,
    account_identifier: email || username,
    module_source,
    task_id,
    opportunity_id,
    rotation_frequency: 'on_failure'
  });

  return Response.json({
    success: true,
    message: 'Account credentials captured and stored',
    identity_id,
    platform
  });
}

/**
 * Intercept OAuth token received
 */
async function onOAuthTokenReceived(base44, user, payload) {
  const {
    identity_id,
    platform,
    access_token,
    refresh_token,
    token_type,
    expires_in,
    module_source,
    task_id
  } = payload;

  // Store access token
  await storeCredential(base44, user, {
    secret_value: access_token,
    secret_name: `${platform}_access_token_${identity_id}`,
    secret_type: 'access_token',
    platform,
    identity_id,
    account_identifier: payload.email || payload.username,
    module_source,
    task_id,
    expiration_date: new Date(Date.now() + expires_in * 1000).toISOString(),
    rotation_frequency: 'on_failure'
  });

  // Store refresh token if provided
  if (refresh_token) {
    await storeCredential(base44, user, {
      secret_value: refresh_token,
      secret_name: `${platform}_refresh_token_${identity_id}`,
      secret_type: 'refresh_token',
      platform,
      identity_id,
      account_identifier: payload.email || payload.username,
      module_source,
      task_id,
      rotation_frequency: 'on_failure'
    });
  }

  return Response.json({
    success: true,
    message: 'OAuth tokens captured and stored',
    identity_id,
    platform,
    token_type
  });
}

/**
 * Intercept generated password
 */
async function onPasswordGenerated(base44, user, payload) {
  const {
    identity_id,
    platform,
    password,
    username,
    email,
    module_source,
    task_id
  } = payload;

  await storeCredential(base44, user, {
    secret_value: password,
    secret_name: `${platform}_password_${identity_id}_generated`,
    secret_type: 'password',
    platform,
    identity_id,
    account_identifier: email || username,
    module_source,
    task_id,
    rotation_frequency: 'on_failure'
  });

  return Response.json({
    success: true,
    message: 'Generated password stored securely',
    identity_id,
    platform
  });
}

/**
 * Intercept API key generation
 */
async function onAPIKeyGenerated(base44, user, payload) {
  const {
    identity_id,
    platform,
    api_key,
    api_secret,
    account_identifier,
    module_source,
    task_id
  } = payload;

  // Store API key
  await storeCredential(base44, user, {
    secret_value: api_key,
    secret_name: `${platform}_api_key_${identity_id}`,
    secret_type: 'api_key',
    platform,
    identity_id,
    account_identifier,
    module_source,
    task_id,
    rotation_frequency: 'quarterly'
  });

  // Store secret if provided
  if (api_secret) {
    await storeCredential(base44, user, {
      secret_value: api_secret,
      secret_name: `${platform}_api_secret_${identity_id}`,
      secret_type: 'api_secret',
      platform,
      identity_id,
      account_identifier,
      module_source,
      task_id,
      rotation_frequency: 'quarterly'
    });
  }

  return Response.json({
    success: true,
    message: 'API credentials stored securely',
    identity_id,
    platform
  });
}

/**
 * Intercept session establishment (cookies, tokens)
 */
async function onSessionEstablished(base44, user, payload) {
  const {
    identity_id,
    platform,
    session_cookie,
    session_token,
    expires_at,
    module_source,
    task_id
  } = payload;

  if (session_cookie) {
    await storeCredential(base44, user, {
      secret_value: session_cookie,
      secret_name: `${platform}_session_cookie_${identity_id}`,
      secret_type: 'session_cookie',
      platform,
      identity_id,
      module_source,
      task_id,
      expiration_date: expires_at,
      rotation_frequency: 'on_failure'
    });
  }

  if (session_token) {
    await storeCredential(base44, user, {
      secret_value: session_token,
      secret_name: `${platform}_session_token_${identity_id}`,
      secret_type: 'session_token',
      platform,
      identity_id,
      module_source,
      task_id,
      expiration_date: expires_at,
      rotation_frequency: 'on_failure'
    });
  }

  return Response.json({
    success: true,
    message: 'Session credentials stored securely',
    identity_id,
    platform
  });
}

/**
 * Intercept verification code
 */
async function onVerificationCodeReceived(base44, user, payload) {
  const {
    identity_id,
    platform,
    verification_code,
    email,
    expires_at,
    module_source,
    task_id
  } = payload;

  await storeCredential(base44, user, {
    secret_value: verification_code,
    secret_name: `${platform}_verification_code_${identity_id}`,
    secret_type: 'verification_code',
    platform,
    identity_id,
    account_identifier: email,
    module_source,
    task_id,
    expiration_date: expires_at,
    rotation_frequency: 'never'
  });

  return Response.json({
    success: true,
    message: 'Verification code stored securely',
    identity_id,
    platform
  });
}

/**
 * Intercept email account creation
 */
async function onEmailCreated(base44, user, payload) {
  const {
    identity_id,
    email,
    password,
    recovery_email,
    backup_codes,
    provider,
    module_source,
    task_id
  } = payload;

  // Store email password
  await storeCredential(base44, user, {
    secret_value: password,
    secret_name: `${provider}_email_password_${identity_id}`,
    secret_type: 'email_password',
    platform: provider,
    identity_id,
    account_identifier: email,
    module_source,
    task_id,
    rotation_frequency: 'on_failure'
  });

  // Store recovery email
  if (recovery_email) {
    await storeCredential(base44, user, {
      secret_value: recovery_email,
      secret_name: `${provider}_recovery_email_${identity_id}`,
      secret_type: 'recovery_email',
      platform: provider,
      identity_id,
      account_identifier: email,
      module_source,
      task_id,
      rotation_frequency: 'never'
    });
  }

  // Store backup codes
  if (backup_codes && Array.isArray(backup_codes)) {
    await storeCredential(base44, user, {
      secret_value: JSON.stringify(backup_codes),
      secret_name: `${provider}_backup_codes_${identity_id}`,
      secret_type: 'backup_codes',
      platform: provider,
      identity_id,
      account_identifier: email,
      module_source,
      task_id,
      rotation_frequency: 'never'
    });
  }

  return Response.json({
    success: true,
    message: 'Email account credentials stored securely',
    identity_id,
    email,
    provider
  });
}

/**
 * Intercept user-provided credentials
 */
async function onUserCredentialProvided(base44, user, payload) {
  const {
    identity_id,
    platform,
    secret_value,
    secret_type,
    account_identifier,
    notes
  } = payload;

  // Validate credential before storing
  const validation = await validateUserCredential(secret_value, secret_type);

  if (!validation.valid) {
    return Response.json(
      { error: `Invalid ${secret_type}: ${validation.error}` },
      { status: 400 }
    );
  }

  await storeCredential(base44, user, {
    secret_value,
    secret_name: `${platform}_${secret_type}_${identity_id}_user_provided`,
    secret_type,
    platform,
    identity_id,
    account_identifier,
    module_source: 'user_input',
    notes: notes || `User-provided ${secret_type}`,
    rotation_frequency: 'on_failure'
  });

  return Response.json({
    success: true,
    message: `${secret_type} stored securely`,
    identity_id,
    platform
  });
}

/**
 * Helper: Store credential via secretManager
 */
async function storeCredential(base44, user, credentialPayload) {
  try {
    const result = await base44.functions.invoke('secretManager', {
      action: 'capture_and_store',
      payload: credentialPayload
    });
    return result.data;
  } catch (error) {
    console.error('Failed to store credential:', error);
    throw error;
  }
}

/**
 * Validate user-provided credential format
 */
function validateUserCredential(secret_value, secret_type) {
  if (!secret_value || secret_value.trim() === '') {
    return { valid: false, error: 'Cannot be empty' };
  }

  // Type-specific validation
  if (secret_type === 'email_password' && secret_value.length < 8) {
    return { valid: false, error: 'Password must be at least 8 characters' };
  }

  if (secret_type === 'api_key' && secret_value.length < 20) {
    return { valid: false, error: 'API key appears to be invalid format' };
  }

  if (secret_type === 'oauth_token' && !secret_value.startsWith('Bearer')) {
    return { valid: false, error: 'OAuth token should start with Bearer' };
  }

  return { valid: true };
}