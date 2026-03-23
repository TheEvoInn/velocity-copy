import { useEffect } from 'react';

export const PerformanceMonitor = {
  metrics: {
    apiCalls: 0,
    avgLatency: 0,
    cacheHits: 0,
    cacheMisses: 0,
    errorCount: 0,
    offlineEvents: 0,
  },

  recordApiCall(latency) {
    this.metrics.apiCalls++;
    const current = this.metrics.avgLatency || 0;
    this.metrics.avgLatency = (current + latency) / 2;
  },

  recordCacheHit() {
    this.metrics.cacheHits++;
  },

  recordCacheMiss() {
    this.metrics.cacheMisses++;
  },

  recordError() {
    this.metrics.errorCount++;
  },

  recordOfflineEvent() {
    this.metrics.offlineEvents++;
  },

  getMetrics() {
    const hitRate = this.metrics.cacheHits + this.metrics.cacheMisses === 0
      ? 0
      : (this.metrics.cacheHits / (this.metrics.cacheHits + this.metrics.cacheMisses)) * 100;

    return {
      ...this.metrics,
      cacheHitRate: hitRate.toFixed(2) + '%',
      successRate: ((this.metrics.apiCalls - this.metrics.errorCount) / (this.metrics.apiCalls || 1)) * 100 | 0,
    };
  },

  reset() {
    this.metrics = {
      apiCalls: 0,
      avgLatency: 0,
      cacheHits: 0,
      cacheMisses: 0,
      errorCount: 0,
      offlineEvents: 0,
    };
  },
};

export function usePerformanceMonitoring() {
  useEffect(() => {
    // Log metrics every 5 minutes
    const interval = setInterval(() => {
      const metrics = PerformanceMonitor.getMetrics();
      console.log('[Performance]', metrics);
    }, 5 * 60 * 1000);

    return () => clearInterval(interval);
  }, []);

  return PerformanceMonitor;
}