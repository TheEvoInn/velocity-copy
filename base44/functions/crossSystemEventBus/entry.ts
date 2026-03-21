/**
 * Cross-System Event Bus
 * Publishes events from all systems and routes them through trigger engine
 * Runs automatically via scheduled automation
 */

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (user?.role !== 'admin') {
      return Response.json({ error: 'Admin access required' }, { status: 403 });
    }

    const { action, event_type, source_system, metric_updates } = await req.json();

    const adminBase44 = base44.asServiceRole;

    // ACTION: Publish event to trigger engine
    if (action === 'publish_event') {
      // Log event
      await adminBase44.entities.ActivityLog.create({
        action_type: 'cross_system_event',
        message: `Event: ${event_type} from ${source_system}`,
        metadata: {
          event_type,
          source_system,
          metric_updates,
          timestamp: new Date().toISOString()
        },
        severity: 'info'
      });

      // Evaluate all triggers for this event
      const triggers = await adminBase44.entities.CrossSystemTrigger.filter(
        {
          enabled: true,
          source_system: source_system
        },
        '-priority'
      );

      const evaluationResults = [];

      for (const trigger of triggers) {
        try {
          const result = await base44.functions.invoke('crossSystemTriggerEngine', {
            action: 'evaluate_trigger',
            trigger_id: trigger.id,
            metric_data: metric_updates,
            user_email: user.email
          });

          evaluationResults.push({
            trigger_id: trigger.id,
            result: result.status
          });
        } catch (err) {
          evaluationResults.push({
            trigger_id: trigger.id,
            error: err.message
          });
        }
      }

      return Response.json({
        status: 'success',
        event_published: true,
        event_type,
        source_system,
        triggers_evaluated: evaluationResults.length,
        results: evaluationResults
      });
    }

    // ACTION: Continuous monitoring (triggered by scheduled automation)
    if (action === 'continuous_monitor') {
      const monitorResults = [];

      // Monitor DigitalCommerce metrics
      try {
        const storefronts = await adminBase44.entities.DigitalStorefront.filter(
          { status: 'published' },
          '-total_revenue',
          100
        );
        const totalRevenue = storefronts.reduce((sum, sf) => sum + (sf.total_revenue || 0), 0);

        await base44.functions.invoke('crossSystemEventBus', {
          action: 'publish_event',
          event_type: 'revenue_milestone',
          source_system: 'DigitalCommerce',
          metric_updates: {
            current_value: totalRevenue,
            baseline_value: totalRevenue * 0.95
          }
        });

        monitorResults.push({ system: 'DigitalCommerce', status: 'ok' });
      } catch (err) {
        monitorResults.push({ system: 'DigitalCommerce', error: err.message });
      }

      // Monitor CryptoAutomation metrics
      try {
        const transactions = await adminBase44.entities.CryptoTransaction.filter(
          { executed_by: 'ned_autopilot' },
          '-timestamp',
          100
        );
        const dailyYield = transactions
          .filter(tx => {
            const txDate = new Date(tx.timestamp);
            const today = new Date();
            return txDate.toDateString() === today.toDateString();
          })
          .reduce((sum, tx) => sum + (tx.value_usd || 0), 0);

        await base44.functions.invoke('crossSystemEventBus', {
          action: 'publish_event',
          event_type: 'yield_performance',
          source_system: 'CryptoAutomation',
          metric_updates: {
            current_value: dailyYield,
            baseline_value: dailyYield * 0.90
          }
        });

        monitorResults.push({ system: 'CryptoAutomation', status: 'ok' });
      } catch (err) {
        monitorResults.push({ system: 'CryptoAutomation', error: err.message });
      }

      // Monitor wallet balance thresholds
      try {
        const wallets = await adminBase44.entities.CryptoWallet.filter(
          { status: 'active' },
          '-balance.total_balance_usd',
          100
        );
        const totalBalance = wallets.reduce((sum, w) => sum + (w.balance?.total_balance_usd || 0), 0);

        await base44.functions.invoke('crossSystemEventBus', {
          action: 'publish_event',
          event_type: 'balance_threshold',
          source_system: 'CryptoAutomation',
          metric_updates: {
            current_value: totalBalance,
            baseline_value: totalBalance * 0.95
          }
        });

        monitorResults.push({ system: 'CryptoAutomation (Wallets)', status: 'ok' });
      } catch (err) {
        monitorResults.push({ system: 'CryptoAutomation (Wallets)', error: err.message });
      }

      return Response.json({
        status: 'success',
        action: 'continuous_monitor',
        systems_monitored: monitorResults.length,
        results: monitorResults,
        timestamp: new Date().toISOString()
      });
    }

    return Response.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error) {
    console.error('Event bus error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});