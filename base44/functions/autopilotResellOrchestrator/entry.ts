import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { action, user_id } = await req.json();

    if (action === 'launch_autonomous_reseller') {
      return await launchAutonomousReseller(base44, user);
    }

    if (action === 'scan_resale_opportunities') {
      return await scanResaleOpportunities(base44, user);
    }

    if (action === 'auto_generate_and_publish') {
      return await autoGenerateAndPublish(base44, user);
    }

    if (action === 'monitor_storefronts') {
      return await monitorStorefronts(base44, user);
    }

    return Response.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});

async function launchAutonomousReseller(base44, user) {
  try {
    // Initialize user's reseller configuration
    const userGoals = await base44.asServiceRole.entities.UserGoals.filter(
      { created_by: user.email }
    ).then(results => results[0]);

    const resellConfig = {
      created_by: user.email,
      user_id: user.id,
      autopilot_enabled: true,
      auto_generate_pages: true,
      auto_publish_pages: true,
      target_monthly_revenue: userGoals?.daily_target * 30 || 30000,
      max_concurrent_pages: 5,
      content_generation_mode: 'ai_driven',
      identity_id: null,
      scanning_enabled: true,
      scan_frequency_hours: 6,
      last_scan_at: null,
      pages_generated: 0,
      pages_published: 0,
      total_revenue_generated: 0,
      status: 'active',
      configuration: {
        product_types: ['digital_products', 'dropship', 'affiliate'],
        auto_payment_setup: true,
        auto_form_creation: true,
        auto_seo_optimization: true,
        email_notifications: true,
        analytics_tracking: true,
      },
    };

    // Create or update reseller config
    const existing = await base44.asServiceRole.entities.ResellAutopilotConfig.filter(
      { created_by: user.email }
    ).then(results => results[0]);

    if (existing) {
      await base44.asServiceRole.entities.ResellAutopilotConfig.update(existing.id, resellConfig);
    } else {
      await base44.asServiceRole.entities.ResellAutopilotConfig.create(resellConfig);
    }

    // Start automated scanning cycle
    await base44.asServiceRole.functions.invoke('autopilotResellOrchestrator', {
      action: 'scan_resale_opportunities',
    });

    return Response.json({
      success: true,
      message: 'Autonomous Digital Reseller launched successfully!',
      status: 'active',
      target_revenue: resellConfig.target_monthly_revenue,
      next_scan: new Date(Date.now() + 6 * 60 * 60 * 1000).toISOString(),
    });
  } catch (error) {
    return Response.json(
      { error: `Failed to launch reseller: ${error.message}` },
      { status: 500 }
    );
  }
}

async function scanResaleOpportunities(base44, user) {
  try {
    // Scan for digital resale opportunities via AI research
    const aiScan = await base44.integrations.Core.InvokeLLM({
      prompt: `Find 5 profitable digital resale opportunities:
      
      Look for:
      - E-book and template marketplaces
      - Dropshipping niches with high margins
      - Digital product bundles
      - Affiliate marketing opportunities
      - SaaS tool resale opportunities
      
      For each, provide:
      {
        "title": "opportunity name",
        "category": "resale|dropship|affiliate|ebook|course",
        "description": "what will be sold",
        "profit_estimate_low": number,
        "profit_estimate_high": number,
        "supplier_url": "where to source from",
        "market_demand": "low|medium|high"
      }`,
      add_context_from_internet: true,
      response_json_schema: {
        type: 'object',
        properties: {
          opportunities: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                title: { type: 'string' },
                category: { type: 'string' },
                description: { type: 'string' },
                profit_estimate_low: { type: 'number' },
                profit_estimate_high: { type: 'number' },
              },
            },
          },
        },
      },
    });

    // Save discovered opportunities
    const createdOpps = [];
    for (const opp of aiScan.opportunities || []) {
      const oppData = {
        created_by: user.email,
        title: opp.title,
        description: opp.description,
        category: 'resale',
        opportunity_type: opp.category,
        platform: 'digital_reseller',
        profit_estimate_low: opp.profit_estimate_low,
        profit_estimate_high: opp.profit_estimate_high,
        status: 'new',
        source: 'autopilot_scan',
        auto_execute: true,
      };

      const created = await base44.asServiceRole.entities.Opportunity.create(oppData);
      createdOpps.push(created);
    }

    // Update scan timestamp
    const config = await base44.asServiceRole.entities.ResellAutopilotConfig.filter(
      { created_by: user.email }
    ).then(results => results[0]);

    if (config) {
      await base44.asServiceRole.entities.ResellAutopilotConfig.update(config.id, {
        last_scan_at: new Date().toISOString(),
      });
    }

    return Response.json({
      success: true,
      opportunities_found: createdOpps.length,
      opportunities: createdOpps,
      message: `Found ${createdOpps.length} new resale opportunities`,
    });
  } catch (error) {
    return Response.json(
      { error: `Scan failed: ${error.message}` },
      { status: 500 }
    );
  }
}

async function autoGenerateAndPublish(base44, user) {
  try {
    // Get pending opportunities
    const pendingOpps = await base44.asServiceRole.entities.Opportunity.filter(
      { status: 'new', created_by: user.email }
    );

    const published = [];

    for (const opp of pendingOpps.slice(0, 3)) {
      try {
        // Generate page
        const pageResult = await base44.asServiceRole.functions.invoke('resellPageGenerator', {
          action: 'generate_complete_page',
          opportunity: opp,
        });

        if (pageResult.success) {
          // Publish immediately
          await base44.asServiceRole.entities.Opportunity.update(opp.id, {
            status: 'published',
            storefront_url: pageResult.preview_url,
          });

          published.push({
            opportunity_id: opp.id,
            title: opp.title,
            storefront_url: pageResult.preview_url,
          });
        }
      } catch (err) {
        console.error(`Failed to process opportunity ${opp.id}:`, err.message);
      }
    }

    return Response.json({
      success: true,
      pages_published: published.length,
      published,
    });
  } catch (error) {
    return Response.json(
      { error: `Auto-publish failed: ${error.message}` },
      { status: 500 }
    );
  }
}

async function monitorStorefronts(base44, user) {
  try {
    // Monitor performance of all active storefronts
    const storefronts = await base44.asServiceRole.entities.DigitalStorefront.filter(
      { created_by: user.email, status: 'published' }
    );

    const metrics = {
      total_storefronts: storefronts.length,
      total_revenue: 0,
      avg_conversion: 0,
      top_performers: [],
    };

    for (const store of storefronts) {
      metrics.total_revenue += store.total_revenue || 0;
      metrics.avg_conversion += store.conversion_rate || 0;
    }

    if (storefronts.length > 0) {
      metrics.avg_conversion = (metrics.avg_conversion / storefronts.length).toFixed(2);
      metrics.top_performers = storefronts
        .sort((a, b) => (b.total_revenue || 0) - (a.total_revenue || 0))
        .slice(0, 3)
        .map(s => ({ title: s.page_title, revenue: s.total_revenue }));
    }

    return Response.json({
      success: true,
      metrics,
      storefronts: storefronts.length,
      next_check: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    });
  } catch (error) {
    return Response.json(
      { error: `Monitor failed: ${error.message}` },
      { status: 500 }
    );
  }
}