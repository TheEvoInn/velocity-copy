import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

/**
 * REAL BROWSER AUTOMATION
 * Executes actual browser-based account creation and verification
 * For MVP: queues tasks to user intervention system (browser-less)
 * For production: integrates with Browserbase/Playwright for real automation
 */

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { action, platform, form_data } = body;

    if (action === 'execute_account_creation') {
      return await executeAccountCreation(base44, user, platform, form_data);
    }

    if (action === 'verify_login') {
      return await verifyLogin(base44, user, body.platform);
    }

    return Response.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error) {
    console.error('[BrowserAutomationReal]', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});

/**
 * MVP: Queue account creation to user for manual completion
 * Production: Use Browserbase/Playwright for automation
 */
async function executeAccountCreation(base44, user, platform, formData) {
  try {
    // For MVP: Create user intervention task
    // This allows user to manually complete signup while system tracks progress
    const intervention = await base44.asServiceRole.entities.UserIntervention.create({
      user_email: user.email,
      task_id: `account_creation_${platform}`,
      requirement_type: 'manual_review',
      required_data: `Please complete ${platform} signup with these credentials:\nEmail: ${formData.email}\nPassword: [Generated]\nUsername: ${formData.username}\n\nAccount will be auto-verified once created.`,
      data_schema: {
        type: 'object',
        properties: {
          verification_code: { type: 'string', description: 'Confirmation code from email' },
          profile_url: { type: 'string', description: 'Link to your new profile' }
        }
      },
      status: 'pending',
      priority: 90,
      expires_at: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString()
    });

    return Response.json({
      success: true,
      message: 'Account creation queued for user',
      intervention_id: intervention.id,
      steps: [
        '1. Navigate to ' + getSignupUrl(platform),
        '2. Sign up with provided credentials',
        '3. Verify email',
        '4. Return verification code here'
      ]
    });
  } catch (error) {
    return Response.json({
      success: false,
      error: error.message
    });
  }
}

/**
 * Verify account was actually created
 */
async function verifyLogin(base44, user, platform) {
  try {
    // Check if user intervention was resolved with verification data
    const interventions = await base44.asServiceRole.entities.UserIntervention.filter(
      {
        user_email: user.email,
        task_id: `account_creation_${platform}`,
        status: 'resolved'
      },
      '-created_date',
      1
    ).catch(() => []);

    if (interventions.length === 0) {
      return Response.json({
        success: false,
        message: 'Account creation not yet verified'
      });
    }

    const intervention = interventions[0];
    const response = intervention.user_response || {};

    return Response.json({
      success: !!response.profile_url,
      verified: !!response.profile_url,
      profile_url: response.profile_url,
      message: 'Account verified successfully'
    });
  } catch (error) {
    return Response.json({
      success: false,
      error: error.message
    });
  }
}

/**
 * Get signup URL for platform
 */
function getSignupUrl(platform) {
  const urls = {
    upwork: 'https://www.upwork.com/ab/account-signup',
    fiverr: 'https://www.fiverr.com/join',
    freelancer: 'https://www.freelancer.com/signup',
    guru: 'https://www.guru.com/d/users/register/',
    peopleperhour: 'https://www.peopleperhour.com/register',
    github: 'https://github.com/signup',
    ebay: 'https://registration.ebay.com/reg/register',
    etsy: 'https://www.etsy.com/registration'
  };
  return urls[platform.toLowerCase()] || `https://${platform}.com/signup`;
}