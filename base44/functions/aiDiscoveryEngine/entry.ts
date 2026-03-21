/**
 * AI Discovery Engine
 * Autonomously scans digital resale niches and crypto yield opportunities
 * Ranks and surfaces actionable opportunities with scoring algorithm
 */

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user?.email) {
      return Response.json({ error: 'User not authenticated' }, { status: 401 });
    }

    const { action, filters = {} } = await req.json();

    // ACTION: Scan for digital resale niches
    if (action === 'scan_digital_niches') {
      const opportunities = await base44.entities.Opportunity.filter(
        { 
          created_by: user.email,
          category: { $in: ['digital_flip', 'arbitrage', 'resale'] }
        },
        '-velocity_score',
        50
      );

      // Get user's existing storefronts
      const storefronts = await base44.entities.DigitalStorefront.filter(
        { created_by: user.email },
        '-created_date',
        100
      );
      const existingCategories = new Set(storefronts.map(s => s.opportunity_id));

      // Score and rank opportunities
      const scoredOpps = opportunities
        .filter(opp => !existingCategories.has(opp.id))
        .map(opp => ({
          id: opp.id,
          title: opp.title,
          description: opp.description,
          category: opp.category,
          platform: opp.platform,
          profit_estimate: {
            low: opp.profit_estimate_low || 0,
            high: opp.profit_estimate_high || 0,
            mid: ((opp.profit_estimate_low || 0) + (opp.profit_estimate_high || 0)) / 2
          },
          velocity_score: opp.velocity_score || 0,
          risk_score: opp.risk_score || 100,
          time_sensitivity: opp.time_sensitivity,
          deadline: opp.deadline,
          // Composite scoring: profit potential + velocity - risk
          action_score: Math.max(0, 
            (((opp.profit_estimate_high || 0) / 5000) * 40) +
            ((opp.velocity_score || 0) * 0.4) -
            ((opp.risk_score || 50) * 0.3)
          ),
          opportunity_type: opp.opportunity_type,
          url: opp.url,
          tags: opp.tags || []
        }))
        .sort((a, b) => b.action_score - a.action_score)
        .slice(0, 15);

      // Log scan activity
      await base44.entities.ActivityLog.create({
        action_type: 'scan',
        message: `Digital niche discovery scan: ${scoredOpps.length} opportunities found`,
        metadata: {
          top_score: scoredOpps[0]?.action_score || 0,
          scan_type: 'digital_resale'
        },
        severity: 'info'
      });

      return Response.json({
        status: 'success',
        scan_type: 'digital_niches',
        opportunities_found: scoredOpps.length,
        opportunities: scoredOpps
      });
    }

    // ACTION: Scan for crypto yield opportunities
    if (action === 'scan_crypto_yields') {
      const cryptoOpps = await base44.entities.CryptoOpportunity.filter(
        { 
          created_by: user.email,
          opportunity_type: { $in: ['staking', 'yield_farming', 'mining'] },
          status: 'active'
        },
        '-priority_score',
        50
      );

      // Get existing staking positions
      const positions = await base44.entities.StakingPosition.filter(
        { created_by: user.email, status: 'active' },
        '-daily_reward_usd',
        100
      );
      const existingTokens = new Set(positions.map(p => p.token_symbol));

      // Score and rank crypto opportunities
      const scoredCrypto = cryptoOpps
        .filter(opp => !existingTokens.has(opp.token_symbol))
        .map(opp => ({
          id: opp.id,
          title: opp.title,
          project_name: opp.project_name,
          token_symbol: opp.token_symbol,
          opportunity_type: opp.opportunity_type,
          description: opp.description,
          estimated_value_usd: opp.estimated_value_usd || 0,
          estimated_time_hours: opp.estimated_time_hours || 0,
          difficulty_level: opp.difficulty_level,
          profit_potential: opp.profit_potential || 0,
          risk_score: opp.risk_score || 50,
          legitimacy_score: opp.legitimacy_score || 70,
          platform: opp.platform,
          deadline: opp.deadline,
          requirements: opp.requirements,
          // Crypto scoring: APY + legitimacy - risk
          action_score: Math.max(0,
            ((opp.profit_potential || 0) * 0.5) +
            ((opp.legitimacy_score || 70) * 0.4) -
            ((opp.risk_score || 50) * 0.2)
          ),
          red_flags: opp.research_data?.red_flags || [],
          tags: opp.opportunity_type
        }))
        .sort((a, b) => b.action_score - a.action_score)
        .slice(0, 15);

      // Log scan activity
      await base44.entities.ActivityLog.create({
        action_type: 'scan',
        message: `Crypto yield discovery scan: ${scoredCrypto.length} opportunities found`,
        metadata: {
          top_score: scoredCrypto[0]?.action_score || 0,
          scan_type: 'crypto_yields'
        },
        severity: 'info'
      });

      return Response.json({
        status: 'success',
        scan_type: 'crypto_yields',
        opportunities_found: scoredCrypto.length,
        opportunities: scoredCrypto
      });
    }

    // ACTION: Get all discovery opportunities (combined and ranked)
    if (action === 'get_all_discoveries') {
      // Scan both types
      const digitalRes = await base44.functions.invoke('aiDiscoveryEngine', {
        action: 'scan_digital_niches'
      });

      const cryptoRes = await base44.functions.invoke('aiDiscoveryEngine', {
        action: 'scan_crypto_yields'
      });

      const allOpps = [
        ...(digitalRes.data?.opportunities || []).map(o => ({ ...o, source_type: 'digital' })),
        ...(cryptoRes.data?.opportunities || []).map(o => ({ ...o, source_type: 'crypto' }))
      ];

      // Sort by action score
      allOpps.sort((a, b) => b.action_score - a.action_score);

      return Response.json({
        status: 'success',
        total_opportunities: allOpps.length,
        digital_count: digitalRes.data?.opportunities_found || 0,
        crypto_count: cryptoRes.data?.opportunities_found || 0,
        opportunities: allOpps
      });
    }

    // ACTION: Quick-create storefront from discovery
    if (action === 'create_storefront_from_discovery') {
      const { opportunity_id, title, headline } = await req.json();

      const opp = await base44.entities.Opportunity.read(opportunity_id);

      if (!opp) {
        return Response.json({ error: 'Opportunity not found' }, { status: 404 });
      }

      const storefront = await base44.entities.DigitalStorefront.create({
        opportunity_id,
        page_title: title || opp.title,
        headline: headline || opp.title,
        description: opp.description,
        status: 'draft',
        features: opp.tags || [],
        call_to_action: 'Get Started Now',
        pricing_copy: `Limited opportunity - act now!`,
        identity_id: user.id,
        brand_colors: {
          primary: '#7c3aed',
          secondary: '#2563eb',
          accent: '#06b6d4'
        }
      });

      await base44.entities.ActivityLog.create({
        action_type: 'user_action',
        message: `Created storefront from discovery: ${opp.title}`,
        metadata: { storefront_id: storefront.id, opportunity_id },
        severity: 'info'
      });

      return Response.json({
        status: 'success',
        storefront_id: storefront.id,
        message: 'Storefront created. Ready for customization.'
      });
    }

    // ACTION: Quick-create staking position from discovery
    if (action === 'create_staking_from_discovery') {
      const { opportunity_id, token_symbol, amount_staked } = await req.json();

      const opp = await base44.entities.CryptoOpportunity.read(opportunity_id);

      if (!opp) {
        return Response.json({ error: 'Opportunity not found' }, { status: 404 });
      }

      const position = await base44.entities.StakingPosition.create({
        token_symbol: token_symbol || opp.token_symbol,
        platform: opp.platform,
        amount_staked: amount_staked || 100,
        staking_type: opp.opportunity_type === 'mining' ? 'pool' : 'delegated',
        status: 'pending_activation',
        apy_percentage: opp.profit_potential || 5,
        started_at: new Date().toISOString(),
        compounding_enabled: true,
        reward_frequency: 'daily'
      });

      await base44.entities.ActivityLog.create({
        action_type: 'user_action',
        message: `Created staking position from discovery: ${token_symbol}`,
        metadata: { position_id: position.id, opportunity_id },
        severity: 'info'
      });

      return Response.json({
        status: 'success',
        position_id: position.id,
        message: 'Staking position initialized.'
      });
    }

    return Response.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error) {
    console.error('AI Discovery Engine error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});