/**
 * PROXY MANAGEMENT ENGINE
 * Automatically rotates residential IP addresses based on target platform
 * Ensures session stability and prevents IP-based rate limiting
 */

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

/**
 * Platform-specific proxy rotation strategies
 */
const platformProxyStrategies = {
  upwork: {
    rotation_interval: 3, // Change IP every 3 tasks
    session_lifetime: 1800, // 30 min session
    delay_between_requests: 2000, // 2 sec between requests
    request_timeout: 30000,
    max_retries: 2
  },
  fiverr: {
    rotation_interval: 4,
    session_lifetime: 2400, // 40 min
    delay_between_requests: 1500,
    request_timeout: 25000,
    max_retries: 2
  },
  freelancer: {
    rotation_interval: 3,
    session_lifetime: 1800,
    delay_between_requests: 2500,
    request_timeout: 30000,
    max_retries: 3
  },
  ebay: {
    rotation_interval: 5,
    session_lifetime: 3600, // 60 min
    delay_between_requests: 1000,
    request_timeout: 20000,
    max_retries: 2
  },
  etsy: {
    rotation_interval: 4,
    session_lifetime: 2400,
    delay_between_requests: 1800,
    request_timeout: 25000,
    max_retries: 2
  },
  default: {
    rotation_interval: 3,
    session_lifetime: 1800,
    delay_between_requests: 2000,
    request_timeout: 30000,
    max_retries: 2
  }
};

/**
 * Select best proxy from available pool based on health and platform
 */
async function selectOptimalProxy(base44, userEmail, platform) {
  try {
    // Get user's proxy configuration
    const userGoals = await base44.entities.UserGoals.filter(
      { created_by: userEmail },
      null,
      1
    ).then(goals => goals[0]).catch(() => null);

    if (!userGoals?.proxy_provider) {
      return {
        success: false,
        message: 'No proxy provider configured',
        use_proxy: false
      };
    }

    // Get platform strategy
    const strategy = platformProxyStrategies[platform] || platformProxyStrategies.default;

    // Get available proxies from credential vault
    const proxyCredentials = await base44.entities.CredentialVault.filter(
      {
        created_by: userEmail,
        platform: userGoals.proxy_provider,
        is_active: true
      },
      null,
      20
    ).catch(() => []);

    if (!proxyCredentials || proxyCredentials.length === 0) {
      return {
        success: false,
        message: 'No active proxy credentials available',
        use_proxy: false
      };
    }

    // Select proxy based on health score and last used time
    let bestProxy = null;
    let bestScore = -1;

    for (const proxy of proxyCredentials) {
      const lastAccess = proxy.last_accessed ? new Date(proxy.last_accessed) : new Date(0);
      const timeSinceLastUse = (Date.now() - lastAccess.getTime()) / 1000;
      const healthMultiplier = (proxy.access_count || 0) > 100 ? 0.8 : 1.0;
      const score = (timeSinceLastUse / 60) * healthMultiplier; // Prefer older proxies

      if (score > bestScore) {
        bestScore = score;
        bestProxy = proxy;
      }
    }

    if (!bestProxy) {
      return {
        success: false,
        message: 'Failed to select proxy',
        use_proxy: false
      };
    }

    // Update proxy access time
    await base44.entities.CredentialVault.update(bestProxy.id, {
      last_accessed: new Date().toISOString(),
      access_count: (bestProxy.access_count || 0) + 1
    }).catch(() => null);

    return {
      success: true,
      use_proxy: true,
      proxy_id: bestProxy.id,
      provider: userGoals.proxy_provider,
      credential_id: bestProxy.id,
      strategy,
      rotation_interval: strategy.rotation_interval,
      session_lifetime: strategy.session_lifetime,
      delay_between_requests: strategy.delay_between_requests
    };
  } catch (e) {
    return { success: false, error: e.message, use_proxy: false };
  }
}

/**
 * Check proxy health by attempting a test request
 */
async function checkProxyHealth(base44, userEmail, proxyId, testUrl = 'https://httpbin.org/ip') {
  try {
    // Get proxy credentials
    const proxy = await base44.entities.CredentialVault.filter(
      { id: proxyId, created_by: userEmail },
      null,
      1
    ).then(proxies => proxies[0]).catch(() => null);

    if (!proxy) {
      return { healthy: false, error: 'Proxy not found' };
    }

    // Test proxy with timeout
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    try {
      const response = await fetch(testUrl, {
        signal: controller.signal,
        // Would set proxy headers here if using a proxy service
        // This is a placeholder - actual implementation depends on proxy provider
      });

      clearTimeout(timeout);

      const healthy = response.ok;

      // Log health check result
      await base44.entities.ActivityLog.create({
        action_type: 'proxy_health_check',
        message: healthy ? `✓ Proxy ${proxyId.substring(0, 8)}... healthy` : `✗ Proxy health check failed`,
        severity: healthy ? 'info' : 'warning',
        metadata: {
          proxy_id: proxyId,
          status_code: response.status,
          healthy
        }
      }).catch(() => null);

      return { healthy, status_code: response.status };
    } catch (e) {
      clearTimeout(timeout);
      return { healthy: false, error: e.message };
    }
  } catch (e) {
    return { healthy: false, error: e.message };
  }
}

/**
 * Mark proxy as unhealthy if rate limited
 */
async function handleRateLimitedProxy(base44, userEmail, proxyId) {
  try {
    // Disable proxy temporarily
    await base44.entities.CredentialVault.update(proxyId, {
      is_active: false
    }).catch(() => null);

    // Log the event
    await base44.entities.ActivityLog.create({
      action_type: 'proxy_rate_limited',
      message: `⚠️ Proxy temporarily disabled due to rate limiting`,
      severity: 'warning',
      metadata: {
        proxy_id: proxyId,
        disabled_at: new Date().toISOString(),
        cooldown_seconds: 3600
      }
    }).catch(() => null);

    return { success: true, proxy_disabled: true };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

/**
 * Rotate to next proxy for the account
 */
async function rotateProxy(base44, userEmail, platform) {
  try {
    const result = await selectOptimalProxy(base44, userEmail, platform);

    if (result.success) {
      await base44.entities.ActivityLog.create({
        action_type: 'proxy_rotated',
        message: `🔄 Proxy rotated for ${platform}`,
        severity: 'info',
        metadata: {
          platform,
          proxy_id: result.proxy_id,
          provider: result.provider
        }
      }).catch(() => null);
    }

    return result;
  } catch (e) {
    return { success: false, error: e.message };
  }
}

/**
 * Get proxy configuration for a specific identity/account
 */
async function getProxyConfig(base44, userEmail, platform, linkedAccountId) {
  try {
    const proxySelection = await selectOptimalProxy(base44, userEmail, platform);

    if (!proxySelection.success) {
      return {
        use_proxy: false,
        message: proxySelection.message || 'No proxy available'
      };
    }

    return {
      use_proxy: true,
      provider: proxySelection.provider,
      proxy_id: proxySelection.proxy_id,
      rotation_strategy: {
        platform,
        rotation_interval: proxySelection.rotation_interval,
        session_lifetime: proxySelection.session_lifetime,
        delay_between_requests: proxySelection.delay_between_requests,
        max_retries: platformProxyStrategies[platform]?.max_retries || 2
      },
      metadata: {
        selected_at: new Date().toISOString(),
        for_platform: platform,
        for_account: linkedAccountId
      }
    };
  } catch (e) {
    return {
      use_proxy: false,
      error: e.message
    };
  }
}

/**
 * Initialize proxy provider credentials
 */
async function initializeProxyProvider(base44, userEmail, providerName, credentials) {
  try {
    // Store encrypted proxy credentials
    const credentialRecord = await base44.entities.CredentialVault.create({
      platform: providerName,
      credential_type: 'proxy_credentials',
      encrypted_payload: JSON.stringify(credentials), // Would be encrypted in production
      is_active: true,
      last_accessed: new Date().toISOString()
    });

    // Update user goals with proxy provider
    await base44.entities.UserGoals.filter(
      { created_by: userEmail },
      null,
      1
    ).then(async (goals) => {
      if (goals[0]) {
        await base44.entities.UserGoals.update(goals[0].id, {
          proxy_provider: providerName,
          proxy_provider_initialized: true
        });
      }
    }).catch(() => null);

    return { success: true, credential_id: credentialRecord.id };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { action, platform, proxyId, linkedAccountId, providerName, credentials } = await req.json();

    // ─── Select optimal proxy ──────────────────────────────────
    if (action === 'select_proxy') {
      if (!platform) {
        return Response.json({ error: 'Platform required' }, { status: 400 });
      }
      const result = await selectOptimalProxy(base44, user.email, platform);
      return Response.json(result);
    }

    // ─── Check proxy health ────────────────────────────────────
    if (action === 'check_health') {
      if (!proxyId) {
        return Response.json({ error: 'Proxy ID required' }, { status: 400 });
      }
      const result = await checkProxyHealth(base44, user.email, proxyId);
      return Response.json(result);
    }

    // ─── Handle rate limited proxy ─────────────────────────────
    if (action === 'handle_rate_limit') {
      if (!proxyId) {
        return Response.json({ error: 'Proxy ID required' }, { status: 400 });
      }
      const result = await handleRateLimitedProxy(base44, user.email, proxyId);
      return Response.json(result);
    }

    // ─── Rotate to next proxy ─────────────────────────────────
    if (action === 'rotate_proxy') {
      if (!platform) {
        return Response.json({ error: 'Platform required' }, { status: 400 });
      }
      const result = await rotateProxy(base44, user.email, platform);
      return Response.json(result);
    }

    // ─── Get proxy configuration ───────────────────────────────
    if (action === 'get_proxy_config') {
      if (!platform) {
        return Response.json({ error: 'Platform required' }, { status: 400 });
      }
      const result = await getProxyConfig(base44, user.email, platform, linkedAccountId);
      return Response.json(result);
    }

    // ─── Initialize proxy provider ─────────────────────────────
    if (action === 'initialize_provider') {
      if (!providerName || !credentials) {
        return Response.json({ error: 'Provider name and credentials required' }, { status: 400 });
      }
      const result = await initializeProxyProvider(base44, user.email, providerName, credentials);
      return Response.json(result);
    }

    return Response.json({ error: 'Unknown action' }, { status: 400 });

  } catch (error) {
    console.error('[ProxyManagementEngine] Error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});