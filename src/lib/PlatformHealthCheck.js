import { base44 } from '@/api/base44Client';

export const performHealthCheck = async () => {
  const health = {
    timestamp: new Date().toISOString(),
    status: 'healthy',
    checks: {},
    issues: [],
  };

  try {
    // Check auth
    try {
      await base44.auth.me();
      health.checks.auth = { status: 'ok', latency: 0 };
    } catch (e) {
      health.checks.auth = { status: 'fail', error: e.message };
      health.issues.push('Authentication service unavailable');
    }

    // Check entity access
    try {
      const start = Date.now();
      await base44.entities.UserGoals?.list?.();
      health.checks.entities = { status: 'ok', latency: Date.now() - start };
    } catch (e) {
      health.checks.entities = { status: 'fail', error: e.message };
      health.issues.push('Entity service unavailable');
    }

    // Check function invocation
    try {
      const start = Date.now();
      await base44.functions.invoke('systemHealthMonitor', {});
      health.checks.functions = { status: 'ok', latency: Date.now() - start };
    } catch (e) {
      health.checks.functions = { status: 'warn', error: e.message };
    }

    health.status = health.issues.length === 0 ? 'healthy' : 'degraded';
  } catch (e) {
    health.status = 'unhealthy';
    health.issues.push(e.message);
  }

  return health;
};

export const startHealthMonitoring = (onHealthChange) => {
  const checkInterval = setInterval(async () => {
    const health = await performHealthCheck();
    onHealthChange?.(health);
  }, 60000); // Check every minute

  return () => clearInterval(checkInterval);
};