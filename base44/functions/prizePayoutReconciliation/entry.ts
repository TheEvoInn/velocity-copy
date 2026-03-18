import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

// Reconcile prize payouts, detect overdue deliveries, and sync with wallet
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { action } = await req.json();

    // ── reconcile_payouts ───────────────────────────────────────────────────────
    if (action === 'reconcile_payouts') {
      const prizes = await base44.asServiceRole.entities.PrizeOpportunity.filter({
        status: { $in: ['won', 'claimed', 'confirmed'] }
      });

      const reconciliation = {
        checked: prizes.length,
        synced: 0,
        overdue: [],
        discrepancies: [],
        wallet_updates: []
      };

      const goals = await base44.asServiceRole.entities.UserGoals.list();
      const userGoal = goals[0];

      for (const prize of prizes) {
        // Check if payout is overdue
        let isOverdue = false;
        let daysOverdue = 0;

        if (prize.time_to_payout) {
          const payoutDate = new Date(prize.time_to_payout);
          const today = new Date();
          if (payoutDate < today) {
            isOverdue = true;
            daysOverdue = Math.floor((today - payoutDate) / (1000 * 60 * 60 * 24));
          }
        }

        // Check if prize is in wallet
        const transactions = await base44.asServiceRole.entities.Transaction.filter({
          opportunity_id: prize.id
        });

        if (transactions.length === 0 && prize.status === 'won' && prize.value_type === 'cash') {
          // Prize won but not in wallet - flag for reconciliation
          reconciliation.discrepancies.push({
            prize_id: prize.id,
            title: prize.title,
            value: prize.prize_value_actual || prize.estimated_value,
            status: 'missing_from_wallet'
          });

          // Create compensatory transaction
          if (userGoal) {
            const txn = await base44.asServiceRole.entities.Transaction.create({
              type: 'income',
              amount: prize.prize_value_actual || prize.estimated_value,
              net_amount: prize.prize_value_actual || prize.estimated_value,
              category: 'other',
              platform: prize.source_name,
              description: `Prize payout reconciliation: ${prize.title}`,
              opportunity_id: prize.id,
              payout_status: 'cleared',
              balance_after: (userGoal.wallet_balance || 0) + (prize.prize_value_actual || prize.estimated_value)
            });

            // Update user balance
            await base44.asServiceRole.entities.UserGoals.update(userGoal.id, {
              wallet_balance: (userGoal.wallet_balance || 0) + (prize.prize_value_actual || prize.estimated_value),
              total_earned: (userGoal.total_earned || 0) + (prize.prize_value_actual || prize.estimated_value)
            });

            reconciliation.wallet_updates.push({
              prize_id: prize.id,
              transaction_id: txn.id,
              amount: prize.prize_value_actual || prize.estimated_value
            });
            reconciliation.synced++;
          }
        }

        // Track overdue payouts
        if (isOverdue && daysOverdue > 0) {
          reconciliation.overdue.push({
            prize_id: prize.id,
            title: prize.title,
            expected_date: prize.time_to_payout,
            days_overdue: daysOverdue,
            status: prize.status
          });
        }
      }

      // Log reconciliation
      await base44.asServiceRole.entities.ActivityLog.create({
        action_type: 'system',
        message: `🔄 Payout reconciliation: ${reconciliation.synced} synced, ${reconciliation.overdue.length} overdue, ${reconciliation.discrepancies.length} discrepancies`,
        severity: reconciliation.overdue.length > 0 ? 'warning' : 'info',
        metadata: reconciliation
      });

      return Response.json({ success: true, reconciliation });
    }

    // ── get_payout_summary ──────────────────────────────────────────────────────
    if (action === 'get_payout_summary') {
      const all = await base44.asServiceRole.entities.PrizeOpportunity.list('-created_date', 500);

      const byStatus = {};
      const byValueType = {};
      let totalValue = 0;
      let totalClaimed = 0;
      const timeline = [];

      all.forEach(p => {
        byStatus[p.status] = (byStatus[p.status] || 0) + 1;
        byValueType[p.value_type || 'unknown'] = (byValueType[p.value_type || 'unknown'] || 0) + 1;

        if (['won', 'claimed', 'confirmed'].includes(p.status)) {
          totalClaimed += p.prize_value_actual || p.estimated_value || 0;
        }
        totalValue += p.estimated_value || 0;

        // Build timeline
        const payoutDate = p.time_to_payout || p.deadline;
        if (payoutDate) {
          timeline.push({
            prize_id: p.id,
            title: p.title,
            status: p.status,
            date: payoutDate,
            value: p.estimated_value || 0
          });
        }
      });

      // Sort timeline
      timeline.sort((a, b) => new Date(a.date) - new Date(b.date));

      return Response.json({
        success: true,
        summary: {
          total_prizes: all.length,
          by_status: byStatus,
          by_value_type: byValueType,
          total_estimated_value: totalValue,
          total_claimed_value: totalClaimed,
          pending_value: all
            .filter(p => ['discovered', 'applying', 'applied', 'evaluating'].includes(p.status))
            .reduce((s, p) => s + (p.estimated_value || 0), 0),
          timeline
        }
      });
    }

    // ── detect_overdue_payouts ──────────────────────────────────────────────────
    if (action === 'detect_overdue_payouts') {
      const all = await base44.asServiceRole.entities.PrizeOpportunity.filter({
        status: { $in: ['applied', 'confirmed', 'won', 'pending_verification'] }
      });

      const overdue = [];
      const today = new Date();

      for (const prize of all) {
        if (prize.time_to_payout) {
          const payoutDate = new Date(prize.time_to_payout);
          if (payoutDate < today) {
            const daysOverdue = Math.floor((today - payoutDate) / (1000 * 60 * 60 * 24));
            overdue.push({
              prize_id: prize.id,
              title: prize.title,
              expected_date: prize.time_to_payout,
              days_overdue: daysOverdue,
              value: prize.estimated_value,
              source: prize.source_name,
              email_used: prize.email_used,
              recommendation: daysOverdue > 14 ? 'Contact support' : 'Wait a few more days'
            });

            // Flag in prize record
            await base44.asServiceRole.entities.PrizeOpportunity.update(prize.id, {
              requires_user_action: true,
              user_action_description: `⚠️ Payout ${daysOverdue} days overdue. Expected: ${prize.time_to_payout}. Recommendation: ${daysOverdue > 14 ? 'Contact support' : 'Monitor for delivery'}`
            });
          }
        }
      }

      // Log detection
      if (overdue.length > 0) {
        await base44.asServiceRole.entities.ActivityLog.create({
          action_type: 'alert',
          message: `⚠️ ${overdue.length} overdue payout(s) detected`,
          severity: 'warning',
          metadata: { overdue_count: overdue.length, overdue }
        });
      }

      return Response.json({ success: true, overdue, count: overdue.length });
    }

    return Response.json({ error: 'Unknown action' }, { status: 400 });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});