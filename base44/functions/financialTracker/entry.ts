/**
 * Financial Tracker
 * - get_summary     : unified financial overview (actual vs pending, tax estimate, fees by platform)
 * - sync_platform   : recalculate fees/tax for a platform's recent transactions
 * - get_tax_report  : quarterly/annual tax estimate breakdown
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

// Platform fee schedules (tiered where applicable)
const PLATFORM_FEES = {
  upwork: (gross, lifetime) => {
    if (lifetime < 500) return 0.20;
    if (lifetime < 10000) return 0.10;
    return 0.05;
  },
  fiverr: () => 0.20,
  freelancer: () => 0.10,
  peopleperhour: () => 0.20,
  toptal: () => 0.00,  // Toptal absorbs fees
  guru: () => 0.089,
  '99designs': () => 0.15,
  servicescape: () => 0.085,
  truelancer: () => 0.08,
  fivesquid: () => 0.20,
  other: () => 0.10
};

// SE tax + income tax estimate by bracket (simplified US self-employment)
function estimateTaxRate(annualizedIncome) {
  const seTax = 0.1413; // 14.13% SE tax (after deduction)
  let incomeTax = 0;
  if (annualizedIncome > 578125) incomeTax = 0.37;
  else if (annualizedIncome > 231250) incomeTax = 0.35;
  else if (annualizedIncome > 182050) incomeTax = 0.32;
  else if (annualizedIncome > 95375) incomeTax = 0.24;
  else if (annualizedIncome > 44725) incomeTax = 0.22;
  else if (annualizedIncome > 11000) incomeTax = 0.12;
  else incomeTax = 0.10;
  // Combined effective rate (rough estimate — advise user to consult CPA)
  return Math.min(seTax + incomeTax * 0.6, 0.50);
}

function getPlatformFee(platform, gross, lifetimeEarnings = 0) {
  const key = (platform || 'other').toLowerCase();
  const fn = PLATFORM_FEES[key] || PLATFORM_FEES.other;
  return fn(gross, lifetimeEarnings);
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const { action = 'get_summary' } = body;

    // ── ACTION: get_summary ───────────────────────────────────────────────────
    if (action === 'get_summary') {
      const transactions = (await base44.asServiceRole.entities.Transaction.list('-created_date', 500).catch(() => [])) || [];
      const accounts = (await base44.asServiceRole.entities.LinkedAccount.list().catch(() => [])) || [];
      const goals = (await base44.asServiceRole.entities.UserGoals.list().catch(() => [])) || [];
      const profile = (Array.isArray(goals) && goals.length > 0) ? goals[0] : {};

      const safeTxs = Array.isArray(transactions) ? transactions : [];
      const incomeTransactions = safeTxs.filter(t => t && t.type === 'income');
      const expenseTransactions = safeTxs.filter(t => t && t.type === 'expense');

      // ── Gross / net / fees ────────────────────────────────────────────────
      const grossIncome = incomeTransactions.reduce((s, t) => s + (typeof t?.amount === 'number' ? t.amount : 0), 0);
      const totalFees = incomeTransactions.reduce((s, t) => s + (typeof t?.platform_fee === 'number' ? t.platform_fee : 0), 0);
      const totalTaxWithheld = incomeTransactions.reduce((s, t) => s + (typeof t?.tax_withheld === 'number' ? t.tax_withheld : 0), 0);
      const netIncome = incomeTransactions.reduce((s, t) => s + (typeof t?.net_amount === 'number' ? t.net_amount : (typeof t?.amount === 'number' ? t.amount : 0)), 0) - totalTaxWithheld;
      const totalExpenses = expenseTransactions.reduce((s, t) => s + (typeof t?.amount === 'number' ? t.amount : 0), 0);

      // ── Payout status breakdown ───────────────────────────────────────────
      const available = incomeTransactions
        .filter(t => t && (!t.payout_status || t.payout_status === 'available' || t.payout_status === 'cleared'))
        .reduce((s, t) => s + (typeof t?.net_amount === 'number' ? t.net_amount : (typeof t?.amount === 'number' ? t.amount : 0)), 0);
      const pending = incomeTransactions
        .filter(t => t && (t.payout_status === 'pending' || t.payout_status === 'in_transit' || t.payout_status === 'processing'))
        .reduce((s, t) => s + (typeof t?.net_amount === 'number' ? t.net_amount : (typeof t?.amount === 'number' ? t.amount : 0)), 0);

      // ── Per-platform breakdown ────────────────────────────────────────────
      const platformMap = {};
      for (const t of incomeTransactions) {
        if (!t) continue;
        const p = (t.platform || 'other').toLowerCase();
        if (!platformMap[p]) platformMap[p] = { gross: 0, fees: 0, net: 0, tax: 0, transactions: 0, pending: 0 };
        platformMap[p].gross += typeof t.amount === 'number' ? t.amount : 0;
        platformMap[p].fees += typeof t.platform_fee === 'number' ? t.platform_fee : 0;
        platformMap[p].net += typeof t.net_amount === 'number' ? t.net_amount : (typeof t.amount === 'number' ? t.amount : 0);
        platformMap[p].tax += typeof t.tax_withheld === 'number' ? t.tax_withheld : 0;
        platformMap[p].transactions++;
        if (t.payout_status === 'pending' || t.payout_status === 'in_transit') {
          platformMap[p].pending += typeof t.net_amount === 'number' ? t.net_amount : (typeof t.amount === 'number' ? t.amount : 0);
        }
      }

      // ── Per-account breakdown (match by linked_account_id) ────────────────
      const safeAccounts = Array.isArray(accounts) ? accounts : [];
      const accountMap = {};
      for (const t of incomeTransactions) {
        if (!t || !t.linked_account_id) continue;
        const acc = safeAccounts.find(a => a && a.id === t.linked_account_id);
        const key = t.linked_account_id;
        if (!accountMap[key]) accountMap[key] = {
          account_id: key,
          platform: (acc?.platform || t.platform || 'unknown'),
          username: (acc?.username || 'Unknown'),
          label: (acc?.label || ''),
          gross: 0, net: 0, fees: 0, transactions: 0
        };
        accountMap[key].gross += typeof t.amount === 'number' ? t.amount : 0;
        accountMap[key].net += typeof t.net_amount === 'number' ? t.net_amount : (typeof t.amount === 'number' ? t.amount : 0);
        accountMap[key].fees += typeof t.platform_fee === 'number' ? t.platform_fee : 0;
        accountMap[key].transactions++;
      }

      // ── Tax estimate (annualized) ─────────────────────────────────────────
      const now = new Date();
      const yearStart = new Date(now.getFullYear(), 0, 1);
      const daysElapsed = Math.max(1, (now - yearStart) / 86400000);
      const ytdIncome = incomeTransactions
        .filter(t => {
          try { return t && new Date(t.created_date) >= yearStart; } catch { return false; }
        })
        .reduce((s, t) => s + (typeof t?.net_amount === 'number' ? t.net_amount : (typeof t?.amount === 'number' ? t.amount : 0)), 0);
      const annualizedIncome = (ytdIncome / daysElapsed) * 365;
      const effectiveTaxRate = estimateTaxRate(typeof annualizedIncome === 'number' ? annualizedIncome : 0);
      const estimatedAnnualTax = annualizedIncome * effectiveTaxRate;
      const estimatedQtrTax = estimatedAnnualTax / 4;
      const alreadyWithheld = incomeTransactions
        .filter(t => {
          try { return t && new Date(t.created_date) >= yearStart; } catch { return false; }
        })
        .reduce((s, t) => s + (typeof t?.tax_withheld === 'number' ? t.tax_withheld : 0), 0);
      const taxOwed = Math.max(0, ytdIncome * effectiveTaxRate - alreadyWithheld);

      // ── Category breakdown ────────────────────────────────────────────────
      const categoryMap = {};
      for (const t of incomeTransactions) {
        if (!t) continue;
        const c = t.category || 'other';
        if (!categoryMap[c]) categoryMap[c] = { gross: 0, net: 0, transactions: 0 };
        categoryMap[c].gross += typeof t.amount === 'number' ? t.amount : 0;
        categoryMap[c].net += typeof t.net_amount === 'number' ? t.net_amount : (typeof t.amount === 'number' ? t.amount : 0);
        categoryMap[c].transactions++;
      }

      return Response.json({
        success: true,
        summary: {
          gross_income: grossIncome,
          total_fees: totalFees,
          total_tax_withheld: totalTaxWithheld,
          net_income: netIncome,
          total_expenses: totalExpenses,
          net_profit: netIncome - totalExpenses,
          available_funds: available - totalTaxWithheld,
          pending_payouts: pending,
          wallet_balance: profile.wallet_balance || 0
        },
        tax: {
          ytd_net_income: ytdIncome,
          annualized_estimate: Math.round(annualizedIncome),
          effective_rate_pct: Math.round(effectiveTaxRate * 100),
          estimated_annual_tax: Math.round(estimatedAnnualTax),
          estimated_quarterly_tax: Math.round(estimatedQtrTax),
          already_withheld: Math.round(alreadyWithheld),
          tax_still_owed_ytd: Math.round(taxOwed),
          next_quarterly_deadline: getNextQtrDeadline(),
          disclaimer: "Estimate only. Consult a tax professional."
        },
        by_platform: platformMap,
        by_account: Object.values(accountMap),
        by_category: categoryMap,
        transaction_count: incomeTransactions.length
      });
    }

    // ── ACTION: sync_platform — recalculate fees+tax for existing transactions ─
    if (action === 'sync_platform') {
      const { platform } = body;
      const transactions = (await base44.asServiceRole.entities.Transaction.list('-created_date', 500).catch(() => [])) || [];
      const safeTxs = Array.isArray(transactions) ? transactions : [];
      const incomeForPlatform = safeTxs.filter(t =>
        t && t.type === 'income' && (platform ? (t.platform || '').toLowerCase() === platform.toLowerCase() : true)
      );

      // Calculate lifetime earnings per platform for tiered fee logic
      const lifetimeByPlatform = {};
      for (const t of safeTxs.filter(t => t && t.type === 'income')) {
        const p = (t.platform || 'other').toLowerCase();
        lifetimeByPlatform[p] = (lifetimeByPlatform[p] || 0) + (typeof t.amount === 'number' ? t.amount : 0);
      }

      let synced = 0;
      for (const t of incomeForPlatform) {
        if (!t) continue;
        try {
          const p = (t.platform || 'other').toLowerCase();
          const lifetime = lifetimeByPlatform[p] || 0;
          const feeRate = getPlatformFee(p, typeof t.amount === 'number' ? t.amount : 0, lifetime);
          const fee = Math.round((typeof t.amount === 'number' ? t.amount : 0) * feeRate * 100) / 100;
          const net = Math.round(((typeof t.amount === 'number' ? t.amount : 0) - fee) * 100) / 100;

          // Estimate tax on net
          const annualized = net * 26;
          const taxRate = estimateTaxRate(annualized);
          const taxWithheld = Math.round(net * taxRate * 100) / 100;

          await base44.asServiceRole.entities.Transaction.update(t.id, {
            platform_fee: fee,
            platform_fee_pct: Math.round(feeRate * 100),
            net_amount: net,
            tax_withheld: taxWithheld,
            tax_rate_pct: Math.round(taxRate * 100)
          });
          synced++;
        } catch (e) {
          console.error(`Failed to sync transaction ${t?.id}:`, e.message);
        }
      }

      return Response.json({ success: true, synced, platform: platform || 'all' });
    }

    // ── ACTION: get_tax_report ─────────────────────────────────────────────────
    if (action === 'get_tax_report') {
      const { year = new Date().getFullYear() } = body;
      const transactions = (await base44.asServiceRole.entities.Transaction.list('-created_date', 1000).catch(() => [])) || [];
      const safeTxs = Array.isArray(transactions) ? transactions : [];

      const yearTransactions = safeTxs.filter(t => {
        if (!t || !t.created_date) return false;
        try {
          const d = new Date(t.created_date);
          return d.getFullYear() === year && t.type === 'income';
        } catch {
          return false;
        }
      });

      const quarterly = { Q1: 0, Q2: 0, Q3: 0, Q4: 0 };
      const quarterlyGross = { Q1: 0, Q2: 0, Q3: 0, Q4: 0 };
      const byPlatform = {};

      for (const t of yearTransactions) {
        if (!t) continue;
        try {
          const month = new Date(t.created_date).getMonth();
          const q = month < 3 ? 'Q1' : month < 6 ? 'Q2' : month < 9 ? 'Q3' : 'Q4';
          quarterly[q] += typeof t.net_amount === 'number' ? t.net_amount : (typeof t.amount === 'number' ? t.amount : 0);
          quarterlyGross[q] += typeof t.amount === 'number' ? t.amount : 0;
          const p = (t.platform || 'other').toLowerCase();
          if (!byPlatform[p]) byPlatform[p] = { gross: 0, fees: 0, net: 0, tax_withheld: 0 };
          byPlatform[p].gross += typeof t.amount === 'number' ? t.amount : 0;
          byPlatform[p].fees += typeof t.platform_fee === 'number' ? t.platform_fee : 0;
          byPlatform[p].net += typeof t.net_amount === 'number' ? t.net_amount : (typeof t.amount === 'number' ? t.amount : 0);
          byPlatform[p].tax_withheld += typeof t.tax_withheld === 'number' ? t.tax_withheld : 0;
        } catch (e) {
          console.error(`Failed to process transaction for tax report:`, e.message);
        }
      }

      const totalNet = Object.values(quarterly).reduce((s, v) => s + (typeof v === 'number' ? v : 0), 0);
      const effectiveRate = estimateTaxRate(typeof totalNet === 'number' ? totalNet : 0);
      const totalTaxDue = totalNet * effectiveRate;
      const totalWithheld = yearTransactions.reduce((s, t) => s + (typeof t?.tax_withheld === 'number' ? t.tax_withheld : 0), 0);

      return Response.json({
        success: true,
        year,
        quarterly_net: quarterly,
        quarterly_gross: quarterlyGross,
        by_platform: byPlatform,
        totals: {
          gross: yearTransactions.reduce((s, t) => s + (t.amount || 0), 0),
          fees: yearTransactions.reduce((s, t) => s + (t.platform_fee || 0), 0),
          net: totalNet,
          effective_tax_rate_pct: Math.round(effectiveRate * 100),
          estimated_tax_due: Math.round(totalTaxDue),
          already_withheld: Math.round(totalWithheld),
          balance_owed: Math.round(Math.max(0, totalTaxDue - totalWithheld))
        },
        quarterly_deadlines: {
          Q1: `${year}-04-15`, Q2: `${year}-06-15`,
          Q3: `${year}-09-15`, Q4: `${year + 1}-01-15`
        },
        disclaimer: "Estimates only. Consult a qualified tax professional."
      });
    }

    return Response.json({ error: 'Unknown action' }, { status: 400 });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});

function getNextQtrDeadline() {
  const now = new Date();
  const year = now.getFullYear();
  const deadlines = [
    new Date(`${year}-04-15`), new Date(`${year}-06-15`),
    new Date(`${year}-09-15`), new Date(`${year + 1}-01-15`)
  ];
  return (deadlines.find(d => d > now) || deadlines[3]).toISOString().split('T')[0];
}