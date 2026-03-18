import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Admin access required' }, { status: 403 });
    }

    // Check if default policies already exist
    const existingPolicies = await base44.asServiceRole.entities.IdentityRoutingPolicy.filter({}, '', 100);

    if (existingPolicies.length > 0) {
      return Response.json({
        success: true,
        message: 'KYC system already initialized',
        policies_count: existingPolicies.length
      });
    }

    // Create default identity routing policies
    const defaultPolicies = [
      {
        rule_name: 'Financial Account Onboarding',
        category: 'financial',
        platform: 'stripe,paypal,coinbase,revolut',
        requires_kyc: true,
        kyc_reason: 'financial_onboarding',
        identity_type: 'auto_detect',
        kyc_verification_type: 'standard',
        keywords: ['bank account', 'payment method', 'card', 'wallet', 'onboarding'],
        priority: 100,
        enabled: true,
        notes: 'Financial platforms always require verified identity'
      },
      {
        rule_name: 'Payment Payout & Transfers',
        category: 'general',
        platform: 'upwork,fiverr,freelancer,toptal',
        requires_kyc: true,
        kyc_reason: 'payment_payout',
        identity_type: 'auto_detect',
        kyc_verification_type: 'standard',
        keywords: ['payout', 'withdrawal', 'transfer', 'payment method'],
        minimum_payout: 500,
        priority: 95,
        enabled: true,
        notes: 'High-value payouts typically require identity verification'
      },
      {
        rule_name: 'Prize & Lottery Claims',
        category: 'contest',
        requires_kyc: true,
        kyc_reason: 'prize_claiming',
        identity_type: 'auto_detect',
        kyc_verification_type: 'enhanced',
        keywords: ['prize', 'lottery', 'claim', 'winnings', 'raffle'],
        minimum_payout: 600,
        priority: 90,
        enabled: true,
        notes: 'Prize claims require enhanced KYC verification'
      },
      {
        rule_name: 'Grant Applications',
        category: 'grant',
        platform: 'grants.gov,sbir.gov,sba.gov',
        requires_kyc: true,
        kyc_reason: 'grant_application',
        identity_type: 'auto_detect',
        kyc_verification_type: 'enhanced',
        keywords: ['grant', 'federal', 'government', 'subsidy', 'funding'],
        priority: 90,
        enabled: true,
        notes: 'Government grants require legal identity verification'
      },
      {
        rule_name: 'Tax Form Submission',
        category: 'general',
        requires_kyc: true,
        kyc_reason: 'tax_compliance',
        identity_type: 'auto_detect',
        kyc_verification_type: 'standard',
        keywords: ['tax', '1099', '1040', 'w2', 'irs', 'tax form', 'tax filing'],
        priority: 85,
        enabled: true,
        notes: 'Tax-related submissions require verified identity'
      },
      {
        rule_name: 'Government Portal Access',
        category: 'government',
        platform: 'irs.gov,sba.gov,ssn.gov,govt,census',
        requires_kyc: true,
        kyc_reason: 'government_compliance',
        identity_type: 'auto_detect',
        kyc_verification_type: 'enhanced',
        priority: 95,
        enabled: true,
        notes: 'Government portals mandate legal identity'
      },
      {
        rule_name: 'Freelance Services (Persona)',
        category: 'freelance',
        platform: 'upwork,fiverr,guru,toptal,freelancer',
        requires_kyc: false,
        identity_type: 'persona',
        keywords: [],
        priority: 50,
        enabled: true,
        notes: 'Freelance work uses persona identities by default'
      },
      {
        rule_name: 'Contest & Giveaway Entries',
        category: 'contest',
        requires_kyc: false,
        identity_type: 'persona',
        keywords: ['contest', 'giveaway', 'sweepstakes', 'entry'],
        priority: 40,
        enabled: true,
        notes: 'Non-prize contest entries can use persona identities'
      },
      {
        rule_name: 'General Marketplace & Resale',
        category: 'resale',
        platform: 'ebay,amazon,etsy,shopify',
        requires_kyc: false,
        identity_type: 'persona',
        keywords: ['sell', 'listing', 'product'],
        priority: 30,
        enabled: true,
        notes: 'Marketplace accounts typically use personas'
      },
      {
        rule_name: 'Arbitrage & Market Activity',
        category: 'arbitrage',
        requires_kyc: false,
        identity_type: 'persona',
        minimum_payout: 0,
        priority: 20,
        enabled: true,
        notes: 'Small-value arbitrage uses personas unless payout exceeds threshold'
      }
    ];

    // Bulk create policies
    for (const policy of defaultPolicies) {
      await base44.asServiceRole.entities.IdentityRoutingPolicy.create(policy);
    }

    return Response.json({
      success: true,
      message: 'KYC system initialized successfully',
      policies_created: defaultPolicies.length,
      policies: defaultPolicies.map(p => ({ name: p.rule_name, kyc_required: p.requires_kyc }))
    });
  } catch (error) {
    console.error('KYC initialization error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});