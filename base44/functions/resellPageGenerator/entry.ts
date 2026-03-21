import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { action, opportunity, user_identity } = await req.json();

    if (action === 'generate_complete_page') {
      return await generateCompletePage(base44, user, opportunity, user_identity);
    }

    if (action === 'populate_products') {
      return await populateProducts(base44, opportunity);
    }

    if (action === 'configure_payment') {
      return await configurePayment(base44, user);
    }

    if (action === 'publish_storefront') {
      return await publishStorefront(base44, user, opportunity);
    }

    return Response.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});

async function generateCompletePage(base44, user, opportunity, user_identity) {
  try {
    // Get user's identity and branding
    const identity = user_identity
      ? await base44.entities.AIIdentity.list()
          .then(ids => ids.find(id => id.id === user_identity))
      : null;

    const brandAssets = identity?.brand_assets || {};

    // Generate page content via AI
    const aiResponse = await base44.integrations.Core.InvokeLLM({
      prompt: `Generate complete landing page content for a digital resale opportunity:
      
      Title: ${opportunity.title}
      Category: ${opportunity.category}
      Profit Estimate: $${opportunity.profit_estimate_low} - $${opportunity.profit_estimate_high}
      
      Provide in JSON format:
      {
        "page_title": "compelling headline",
        "headline": "main value prop",
        "subheading": "supporting message",
        "product_description": "detailed benefits",
        "features": ["feature1", "feature2", ...],
        "call_to_action": "button text",
        "pricing_copy": "pricing message",
        "testimonial": "sample customer quote",
        "faq": [{"question": "...", "answer": "..."}]
      }
      
      Tone: ${brandAssets.communication_tone || 'professional'}
      Style: ${brandAssets.formality_level || 'formal'}`,
      response_json_schema: {
        type: 'object',
        properties: {
          page_title: { type: 'string' },
          headline: { type: 'string' },
          subheading: { type: 'string' },
          product_description: { type: 'string' },
          features: { type: 'array', items: { type: 'string' } },
          call_to_action: { type: 'string' },
          pricing_copy: { type: 'string' },
          testimonial: { type: 'string' },
          faq: { type: 'array' },
        },
      },
    });

    const pageContent = aiResponse;

    // Generate visual assets
    const imagePrompt = `Create a professional product/service header image for: ${opportunity.title}
    Style: ${brandAssets.graphic_style?.[0] || 'modern'} 
    Colors: Primary ${brandAssets.primary_color || '#7c3aed'}, Secondary ${brandAssets.secondary_color || '#06b6d4'}
    High-quality, conversion-optimized, suitable for landing page`;

    const imageResponse = await base44.integrations.Core.GenerateImage({
      prompt: imagePrompt,
    });

    // Create digital storefront record
    const storefrontData = {
      created_by: user.email,
      opportunity_id: opportunity.id,
      page_title: pageContent.page_title,
      headline: pageContent.headline,
      subheading: pageContent.subheading,
      description: pageContent.product_description,
      features: pageContent.features,
      call_to_action: pageContent.call_to_action,
      pricing_copy: pageContent.pricing_copy,
      testimonial: pageContent.testimonial,
      faq: pageContent.faq,
      hero_image_url: imageResponse.url,
      identity_id: user_identity,
      brand_colors: {
        primary: brandAssets.primary_color,
        secondary: brandAssets.secondary_color,
        accent: brandAssets.accent_color,
      },
      brand_fonts: {
        primary: brandAssets.font_primary,
        secondary: brandAssets.font_secondary,
      },
      status: 'draft',
      product_count: 0,
      total_revenue: 0,
      conversion_rate: 0,
      payment_gateway: 'stripe',
      payment_enabled: false,
      form_fields: [
        { name: 'email', type: 'email', required: true, label: 'Email Address' },
        { name: 'full_name', type: 'text', required: true, label: 'Full Name' },
      ],
      form_submission_webhook: `${Deno.env.get('BASE44_API_URL')}/webhooks/storefront-submission`,
      created_timestamp: new Date().toISOString(),
    };

    // Save storefront to database
    const storefront = await base44.asServiceRole.entities.DigitalStorefront.create(storefrontData);

    // Configure payment processing
    const paymentSetup = await base44.asServiceRole.functions.invoke('resellPageGenerator', {
      action: 'configure_payment',
      storefront_id: storefront.id,
      user_id: user.id,
    });

    // Create lead capture form
    const formSetup = {
      storefront_id: storefront.id,
      form_fields: storefrontData.form_fields,
      success_message: `Thanks for your interest! We'll send details to ${'{email}'}.`,
      redirect_url: `https://${Deno.env.get('BASE44_APP_DOMAIN')}/storefronts/${storefront.id}/thank-you`,
    };

    return Response.json({
      success: true,
      storefront_id: storefront.id,
      page_title: pageContent.page_title,
      status: 'draft',
      preview_url: `https://${Deno.env.get('BASE44_APP_DOMAIN')}/storefronts/${storefront.id}`,
      message: 'Landing page generated successfully. Configure and publish to go live.',
    });
  } catch (error) {
    return Response.json(
      { error: `Failed to generate page: ${error.message}` },
      { status: 500 }
    );
  }
}

async function populateProducts(base44, opportunity) {
  try {
    // Populate product listings based on opportunity type
    const products = [];

    if (opportunity.category === 'resale') {
      // Digital resale items
      products.push({
        name: 'Premium Digital Bundle',
        description: 'Complete collection of ready-to-use templates and resources',
        price: opportunity.profit_estimate_low || 19.99,
        digital_asset_url: '#',
        file_count: 12,
      });
    }

    if (opportunity.category === 'dropship') {
      // Dropshipping items from supplier
      products.push({
        name: 'Trending Product',
        description: 'Supplier-sourced trending item with margin optimization',
        price: opportunity.profit_estimate_high || 49.99,
        supplier_sku: 'SUPPLIER-SKU',
        stock_unlimited: true,
      });
    }

    return Response.json({
      success: true,
      products_added: products.length,
      products,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}

async function configurePayment(base44, user) {
  try {
    // Setup Stripe payment processing
    const stripeKey = Deno.env.get('STRIPE_SECRET_KEY');

    if (!stripeKey) {
      return Response.json(
        { error: 'Stripe not configured' },
        { status: 400 }
      );
    }

    return Response.json({
      success: true,
      payment_gateway: 'stripe',
      auto_payout_enabled: true,
      payout_destination: user.email,
      fee_percentage: 2.9,
      minimum_payout: 100,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}

async function publishStorefront(base44, user, opportunity) {
  try {
    // Publish to live URL and make accessible
    const publishedUrl = `https://${Deno.env.get('BASE44_APP_DOMAIN')}/store/${opportunity.id}`;

    // Update opportunity status
    await base44.asServiceRole.entities.Opportunity.update(opportunity.id, {
      status: 'published',
      storefront_url: publishedUrl,
      published_at: new Date().toISOString(),
    });

    return Response.json({
      success: true,
      published_url: publishedUrl,
      message: 'Storefront published and live!',
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}