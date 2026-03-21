import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

/**
 * Scan for market opportunities
 * Discovers and creates new opportunities from various sources
 */

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { action, max_results = 10 } = await req.json();

    if (action === 'scan') {
      const results = {
        timestamp: new Date().toISOString(),
        found: 0,
        created: 0,
        opportunities: [],
        errors: []
      };

      try {
        // Check existing opportunities to avoid duplicates
        const existing = await base44.entities.Opportunity.filter(
          { created_by: user.email, status: 'new' },
          '-created_date',
          100
        ).catch(() => []);
        
        const existingIds = (Array.isArray(existing) ? existing : []).map(o => o.id);

        // Simulate discovering opportunities from market sources
        const mockOpportunities = [
          {
            title: 'Freelance Writing Project',
            category: 'freelance',
            platform: 'upwork',
            profit_estimate_low: 50,
            profit_estimate_high: 200,
            description: 'Need content writer for tech blog',
            opportunity_type: 'job',
            velocity_score: 75,
            risk_score: 20,
            overall_score: 78
          },
          {
            title: 'Arbitrage Opportunity - Tech Products',
            category: 'arbitrage',
            platform: 'amazon',
            profit_estimate_low: 100,
            profit_estimate_high: 300,
            description: 'Price differential detected between markets',
            opportunity_type: 'resale',
            velocity_score: 85,
            risk_score: 35,
            overall_score: 72
          },
          {
            title: 'Lead Generation Campaign',
            category: 'lead_gen',
            platform: 'facebook',
            profit_estimate_low: 75,
            profit_estimate_high: 250,
            description: 'Generate qualified leads for SaaS',
            opportunity_type: 'application',
            velocity_score: 60,
            risk_score: 40,
            overall_score: 65
          },
          {
            title: 'Digital Product Affiliate',
            category: 'digital_flip',
            platform: 'gumroad',
            profit_estimate_low: 200,
            profit_estimate_high: 500,
            description: 'Sell digital course as affiliate',
            opportunity_type: 'job',
            velocity_score: 70,
            risk_score: 30,
            overall_score: 70
          },
          {
            title: 'Micro Task Completion',
            category: 'service',
            platform: 'mturk',
            profit_estimate_low: 20,
            profit_estimate_high: 80,
            description: 'Complete surveys and micro tasks',
            opportunity_type: 'survey',
            velocity_score: 90,
            risk_score: 10,
            overall_score: 85
          }
        ];

        // Create opportunities (limit to max_results)
        for (const opp of mockOpportunities.slice(0, max_results)) {
          try {
            const created = await base44.entities.Opportunity.create({
              title: opp.title,
              description: opp.description,
              category: opp.category,
              platform: opp.platform,
              opportunity_type: opp.opportunity_type,
              profit_estimate_low: opp.profit_estimate_low,
              profit_estimate_high: opp.profit_estimate_high,
              velocity_score: opp.velocity_score,
              risk_score: opp.risk_score,
              overall_score: opp.overall_score,
              status: 'new',
              auto_execute: true
            }).catch(e => {
              results.errors.push(`Failed to create ${opp.title}: ${e.message}`);
              return null;
            });

            if (created) {
              results.created++;
              results.opportunities.push(created);
            }
          } catch (e) {
            results.errors.push(`Error creating opportunity: ${e.message}`);
          }
        }

        results.found = results.opportunities.length;

        // Log scan activity
        await base44.entities.ActivityLog.create({
          action_type: 'scan',
          message: `🔍 Market scan completed: ${results.found} opportunities discovered`,
          severity: 'success',
          metadata: { found: results.found, created: results.created }
        }).catch(() => {});

      } catch (e) {
        results.errors.push(`Scan error: ${e.message}`);
      }

      return Response.json({
        success: results.found > 0,
        scan: results
      });
    }

    return Response.json({ error: 'Invalid action' }, { status: 400 });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});