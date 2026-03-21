/**
 * Platform Cross-Communication Service
 * Enables real-time data sharing between scanning, execution, and finance departments
 * Enhances the profit ecosystem through coordinated opportunity distribution
 */
import { base44 } from '@/api/base44Client';

const PLATFORM_EVENTS = {
  OPPORTUNITY_FOUND: 'platform:opportunity:found',
  OPPORTUNITY_QUEUED: 'platform:opportunity:queued',
  OPPORTUNITY_EXECUTED: 'platform:opportunity:executed',
  OPPORTUNITY_COMPLETED: 'platform:opportunity:completed',
  SCAN_STARTED: 'platform:scan:started',
  SCAN_COMPLETED: 'platform:scan:completed',
  MARKET_UPDATE: 'platform:market:update',
  PLATFORM_DISCOVERED: 'platform:new_platform_discovered',
};

class PlatformCrossComm {
  constructor() {
    this.listeners = new Map();
    this.eventQueue = [];
    this.maxQueueSize = 100;
  }

  // Subscribe to cross-platform events
  subscribe(eventType, callback) {
    if (!this.listeners.has(eventType)) {
      this.listeners.set(eventType, []);
    }
    this.listeners.get(eventType).push(callback);
    return () => this.unsubscribe(eventType, callback);
  }

  unsubscribe(eventType, callback) {
    if (this.listeners.has(eventType)) {
      const callbacks = this.listeners.get(eventType);
      const idx = callbacks.indexOf(callback);
      if (idx > -1) callbacks.splice(idx, 1);
    }
  }

  // Emit cross-platform event
  async emit(eventType, data) {
    const event = {
      type: eventType,
      timestamp: new Date().toISOString(),
      data,
    };

    // Queue event for persistence
    this.eventQueue.push(event);
    if (this.eventQueue.length > this.maxQueueSize) {
      this.eventQueue.shift();
    }

    // Trigger local listeners
    const callbacks = this.listeners.get(eventType) || [];
    for (const callback of callbacks) {
      try {
        await callback(data);
      } catch (err) {
        console.error(`Error in listener for ${eventType}:`, err);
      }
    }

    // Log to activity for cross-department visibility
    this.logActivity(eventType, data);
  }

  // Log event to activity for real-time cross-platform notifications
  async logActivity(eventType, data) {
    try {
      const messages = {
        [PLATFORM_EVENTS.OPPORTUNITY_FOUND]: `🎯 New opportunity discovered: ${data.title} on ${data.platform}`,
        [PLATFORM_EVENTS.OPPORTUNITY_QUEUED]: `📋 Task queued: ${data.opportunity_title} → Execution`,
        [PLATFORM_EVENTS.OPPORTUNITY_EXECUTED]: `⚡ Task executing: ${data.opportunity_title}`,
        [PLATFORM_EVENTS.OPPORTUNITY_COMPLETED]: `✅ Completed: ${data.opportunity_title} — $${data.earned || 0}`,
        [PLATFORM_EVENTS.SCAN_STARTED]: `🔍 Market scan started (${data.source || 'multi-source'})`,
        [PLATFORM_EVENTS.SCAN_COMPLETED]: `🔍 Scan complete: ${data.total_found || 0} opportunities found`,
        [PLATFORM_EVENTS.MARKET_UPDATE]: `📊 Market update: ${data.message}`,
        [PLATFORM_EVENTS.PLATFORM_DISCOVERED]: `🌐 New platform discovered: ${data.platform_name}`,
      };

      const message = messages[eventType] || `Event: ${eventType}`;
      await base44.asServiceRole.entities.ActivityLog.create({
        action_type: 'cross_platform_event',
        message,
        severity: data.severity || 'info',
        metadata: {
          event_type: eventType,
          ...data,
        },
      }).catch(() => {});
    } catch (err) {
      console.error('Failed to log activity:', err);
    }
  }

  // Get event history
  getEventHistory(eventType = null, limit = 50) {
    if (eventType) {
      return this.eventQueue.filter(e => e.type === eventType).slice(-limit);
    }
    return this.eventQueue.slice(-limit);
  }

  // Get platform stats from cross-platform events
  getPlatformStats() {
    const stats = {
      opportunities_found: this.eventQueue.filter(e => e.type === PLATFORM_EVENTS.OPPORTUNITY_FOUND).length,
      opportunities_queued: this.eventQueue.filter(e => e.type === PLATFORM_EVENTS.OPPORTUNITY_QUEUED).length,
      opportunities_completed: this.eventQueue.filter(e => e.type === PLATFORM_EVENTS.OPPORTUNITY_COMPLETED).length,
      scans_run: this.eventQueue.filter(e => e.type === PLATFORM_EVENTS.SCAN_COMPLETED).length,
    };
    return stats;
  }

  // Get opportunities ready for execution based on platform data
  async getReadyForExecution(limit = 10) {
    try {
      const opps = await base44.asServiceRole.entities.Opportunity.filter(
        { status: 'new' },
        '-overall_score',
        limit
      );
      return Array.isArray(opps) ? opps : [];
    } catch (err) {
      console.error('Failed to get opportunities for execution:', err);
      return [];
    }
  }

  // Notify all departments of market opportunity
  async broadcastOpportunity(opportunity) {
    if (!opportunity?.id) return;
    await this.emit(PLATFORM_EVENTS.OPPORTUNITY_FOUND, {
      opportunity_id: opportunity.id,
      title: opportunity.title,
      platform: opportunity.platform,
      estimated_value: opportunity.profit_estimate_high,
      category: opportunity.category,
      source: opportunity.source || 'system',
    });
  }

  // Notify execution to queue task
  async notifyQueueing(opportunity, identity) {
    if (!opportunity?.id) return;
    await this.emit(PLATFORM_EVENTS.OPPORTUNITY_QUEUED, {
      opportunity_id: opportunity.id,
      opportunity_title: opportunity.title,
      identity_id: identity?.id,
      identity_name: identity?.name,
      platform: opportunity.platform,
    });
  }

  // Notify completion for finance tracking
  async notifyCompletion(taskId, opportunity, earned) {
    await this.emit(PLATFORM_EVENTS.OPPORTUNITY_COMPLETED, {
      task_id: taskId,
      opportunity_id: opportunity?.id,
      opportunity_title: opportunity?.title,
      platform: opportunity?.platform,
      earned: earned || 0,
    });
  }
}

// Export singleton instance
export const platformComm = new PlatformCrossComm();
export { PLATFORM_EVENTS };