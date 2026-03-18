/**
 * Initialize default spending policies for a user.
 * Call once to seed the SpendingPolicy table with sensible defaults.
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

const DEFAULT_POLICIES = [
  { category: 'global', max_per_task: 50, max_per_day: 200, auto_approve_threshold: 10, min_roi_pct: 20, max_chain_depth: 3, max_daily_transactions: 10, conditional_approval_roi_threshold: 50 },
  { category: 'arbitrage', max_per_task: 100, max_per_day: 300, auto_approve_threshold: 15, min_roi_pct: 15, max_chain_depth: 4, max_daily_transactions: 8, conditional_approval_roi_threshold: 40 },
  { category: 'auction', max_per_task: 75, max_per_day: 250, auto_approve_threshold: 10, min_roi_pct: 25, max_chain_depth: 3, max_daily_transactions: 6, conditional_approval_roi_threshold: 50 },
  { category: 'digital_flip', max_per_task: 60, max_per_day: 200, auto_approve_threshold: 12, min_roi_pct: 30, max_chain_depth: 3, max_daily_transactions: 8, conditional_approval_roi_threshold: 60 },
  { category: 'tool', max_per_task: 30, max_per_day: 100, auto_approve_threshold: 5, min_roi_pct: 50, max_chain_depth: 2, max_daily_transactions: 5, conditional_approval_roi_threshold: 80 },
  { category: 'fee', max_per_task: 20, max_per_day: 80, auto_approve_threshold: 5, min_roi_pct: 40, max_chain_depth: 2, max_daily_transactions: 10, conditional_approval_roi_threshold: 70 },
  { category: 'freelance', max_per_task: 25, max_per_day: 100, auto_approve_threshold: 8, min_roi_pct: 100, max_chain_depth: 2, max_daily_transactions: 5, conditional_approval_roi_threshold: 150 },
  { category: 'resale', max_per_task: 80, max_per_day: 250, auto_approve_threshold: 15, min_roi_pct: 20, max_chain_depth: 4, max_daily_transactions: 8, conditional_approval_roi_threshold: 40 },
  { category: 'upgrade', max_per_task: 40, max_per_day: 100, auto_approve_threshold: 5, min_roi_pct: 60, max_chain_depth: 2, max_daily_transactions: 3, conditional_approval_roi_threshold: 100 },
];

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Admin only' }, { status: 403 });
    }

    const existing = await base44.asServiceRole.entities.SpendingPolicy.list();
    if (existing.length > 0) {
      return Response.json({ message: 'Policies already initialized', count: existing.length, policies: existing });
    }

    const created = await base44.asServiceRole.entities.SpendingPolicy.bulkCreate(DEFAULT_POLICIES);
    return Response.json({ success: true, created: created.length, policies: created });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});