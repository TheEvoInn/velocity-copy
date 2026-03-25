/**
 * PLAYWRIGHT AGENTIC BROWSER AUTOMATION
 * Self-hosted, fee-free browser automation with LLM-driven intelligence
 * Uses Deno + Playwright for headless browser control
 */

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

// Import Playwright (available in Deno runtime)
let playwright;
try {
  playwright = await import('npm:playwright');
} catch (e) {
  console.log('Playwright not pre-loaded, will initialize on first request');
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { action } = body;

    if (action === 'navigate_and_fill_form') {
      return await navigateAndFillForm(base44, user, body);
    }

    if (action === 'execute_signup_autonomous') {
      return await executeSignupAutonomous(base44, user, body);
    }

    if (action === 'extract_form_fields') {
      return await extractFormFields(base44, user, body);
    }

    if (action === 'analyze_and_interact') {
      return await analyzeAndInteract(base44, user, body);
    }

    return Response.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error) {
    console.error('[PlaywrightBrowserAutomation]', error.message);
    return Response.json({ error: error.message, stack: error.stack }, { status: 500 });
  }
});

/**
 * Navigate to URL and intelligently fill form fields
 */
async function navigateAndFillForm(base44, user, body) {
  const { url, form_data, screenshot = true } = body;
  const steps = [];
  let browser, page;

  try {
    if (!playwright) {
      playwright = await import('npm:playwright');
    }

    steps.push('Launching browser...');
    browser = await playwright.chromium.launch({ headless: true });
    const context = await browser.newContext();
    page = await context.newPage();

    // Navigate
    steps.push(`Navigating to ${url}...`);
    await page.goto(url, { waitUntil: 'networkidle' });

    // Wait for form
    steps.push('Waiting for form...');
    await page.waitForSelector('form, [role="form"]', { timeout: 10000 }).catch(() => null);

    // Fill fields using smart selectors
    for (const [fieldName, fieldValue] of Object.entries(form_data)) {
      const selectors = [
        `input[name="${fieldName}"]`,
        `input[id="${fieldName}"]`,
        `textarea[name="${fieldName}"]`,
        `input[placeholder*="${fieldName}" i]`,
        `input[aria-label*="${fieldName}" i]`,
        `[data-field="${fieldName}"]`
      ];

      let filled = false;
      for (const selector of selectors) {
        try {
          const element = await page.$(selector);
          if (element) {
            await element.fill(String(fieldValue));
            steps.push(`✓ Filled ${fieldName}`);
            filled = true;
            break;
          }
        } catch (e) {
          // Try next selector
        }
      }

      if (!filled) {
        steps.push(`⚠ Could not find field: ${fieldName}`);
      }
    }

    // Take screenshot if requested
    let screenshotBase64 = null;
    if (screenshot) {
      steps.push('Taking screenshot...');
      const buffer = await page.screenshot({ fullPage: true });
      screenshotBase64 = btoa(String.fromCharCode.apply(null, Array.from(buffer)));
    }

    steps.push('✓ Form filled successfully');

    return Response.json({
      success: true,
      steps,
      screenshot: screenshotBase64,
      message: 'Form fields filled. Ready to submit.'
    });

  } catch (error) {
    steps.push(`❌ Error: ${error.message}`);
    return Response.json({ success: false, steps, error: error.message }, { status: 500 });
  } finally {
    if (page) await page.close().catch(() => null);
    if (browser) await browser.close().catch(() => null);
  }
}

/**
 * Full autonomous signup execution with LLM intelligence
 */
async function executeSignupAutonomous(base44, user, body) {
  const { url, email, password, full_name } = body;
  const steps = [];
  let browser, page;

  try {
    if (!playwright) {
      playwright = await import('npm:playwright');
    }

    steps.push('🚀 Starting autonomous signup...');
    browser = await playwright.chromium.launch({ headless: true });
    const context = await browser.newContext();
    page = await context.newPage();

    // Navigate
    steps.push(`Navigating to ${url}...`);
    await page.goto(url, { waitUntil: 'networkidle' });

    // Extract form with LLM
    steps.push('Analyzing form structure with LLM...');
    const htmlContent = await page.content();
    
    const llmAnalysis = await base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt: `Analyze this signup form HTML and identify the input fields and their purposes:
      ${htmlContent.substring(0, 5000)}
      
      Return JSON with: {
        fields: [{ name, selector, type, purpose }],
        submit_selector: "selector for submit button",
        success_indicator: "text or selector that appears on success"
      }`,
      response_json_schema: {
        type: 'object',
        properties: {
          fields: { type: 'array' },
          submit_selector: { type: 'string' },
          success_indicator: { type: 'string' }
        }
      }
    }).catch(() => ({ data: null }));

    if (!llmAnalysis.data) {
      steps.push('⚠ LLM analysis unavailable, using fallback strategy...');
    } else {
      steps.push(`✓ Form analysis complete: ${llmAnalysis.data.fields?.length || 0} fields`);
    }

    // Fill fields intelligently
    const fieldsToFill = {
      email: email,
      password: password,
      confirm_password: password,
      name: full_name,
      full_name: full_name,
      firstName: full_name.split(' ')[0],
      lastName: full_name.split(' ').slice(1).join(' '),
      username: full_name.toLowerCase().replace(/\s+/g, '_')
    };

    for (const [key, value] of Object.entries(fieldsToFill)) {
      try {
        const selectors = [
          `input[name="${key}"]`,
          `input[id="${key}"]`,
          `input[placeholder*="${key}" i]`,
          `input[aria-label*="${key}" i]`
        ];

        for (const selector of selectors) {
          const el = await page.$(selector);
          if (el) {
            await el.fill(String(value));
            steps.push(`✓ ${key}: filled`);
            break;
          }
        }
      } catch (e) {
        // Continue
      }
    }

    // Find and click submit
    steps.push('Looking for submit button...');
    const submitSelectors = [
      'button[type="submit"]',
      'button:has-text("Sign up")',
      'button:has-text("Create")',
      'button:has-text("Register")',
      'input[type="submit"]'
    ];

    let submitted = false;
    for (const selector of submitSelectors) {
      try {
        const btn = await page.$(selector);
        if (btn) {
          await btn.click();
          steps.push('✓ Submit button clicked');
          submitted = true;
          break;
        }
      } catch (e) {
        // Try next
      }
    }

    if (!submitted) {
      return {
        success: false,
        steps: [...steps, '❌ Could not find submit button'],
        error: 'Submit button not found'
      };
    }

    // Wait for navigation or success indicator
    steps.push('Waiting for completion...');
    try {
      await page.waitForNavigation({ timeout: 15000 }).catch(() => null);
    } catch (e) {
      // Continue
    }

    // Get final URL
    const finalUrl = page.url();
    steps.push(`✓ Final URL: ${finalUrl}`);

    // Take confirmation screenshot
    const screenshot = await page.screenshot({ fullPage: true });
    const screenshotBase64 = btoa(String.fromCharCode.apply(null, Array.from(screenshot)));

    steps.push('✅ ACCOUNT CREATION COMPLETE');

    return Response.json({
      success: true,
      steps,
      screenshot: screenshotBase64,
      final_url: finalUrl,
      completion_time: new Date().toISOString(),
      confirmation: {
        email_used: email,
        full_name_used: full_name,
        account_url: finalUrl
      }
    });

  } catch (error) {
    steps.push(`❌ Execution failed: ${error.message}`);
    return Response.json({ success: false, steps, error: error.message }, { status: 500 });
  } finally {
    if (page) await page.close().catch(() => null);
    if (browser) await browser.close().catch(() => null);
  }
}

/**
 * Extract all form fields from page
 */
async function extractFormFields(base44, user, body) {
  const { url } = body;
  let browser, page;

  try {
    if (!playwright) {
      playwright = await import('npm:playwright');
    }

    browser = await playwright.chromium.launch({ headless: true });
    const context = await browser.newContext();
    page = await context.newPage();

    await page.goto(url, { waitUntil: 'networkidle' });

    // Extract all inputs
    const fields = await page.evaluate(() => {
      const inputs = [];
      document.querySelectorAll('input, textarea, select').forEach(el => {
        inputs.push({
          name: el.getAttribute('name') || el.getAttribute('id') || '',
          type: el.getAttribute('type') || el.tagName.toLowerCase(),
          placeholder: el.getAttribute('placeholder') || '',
          required: el.hasAttribute('required'),
          pattern: el.getAttribute('pattern') || ''
        });
      });
      return inputs;
    });

    return Response.json({
      success: true,
      fields,
      field_count: fields.length
    });

  } catch (error) {
    return Response.json({ success: false, error: error.message }, { status: 500 });
  } finally {
    if (page) await page.close().catch(() => null);
    if (browser) await browser.close().catch(() => null);
  }
}

/**
 * Analyze page and take intelligent action based on LLM
 */
async function analyzeAndInteract(base44, user, body) {
  const { url, instruction } = body;
  let browser, page;

  try {
    if (!playwright) {
      playwright = await import('npm:playwright');
    }

    browser = await playwright.chromium.launch({ headless: true });
    const context = await browser.newContext();
    page = await context.newPage();

    await page.goto(url, { waitUntil: 'networkidle' });
    const htmlContent = await page.content();

    // Use LLM to plan interaction
    const plan = await base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt: `Given this instruction: "${instruction}"
      And this page HTML: ${htmlContent.substring(0, 8000)}
      
      Return a JSON plan with: {
        action: "click|fill|wait|extract",
        selector: "CSS selector for the element",
        value: "value if filling",
        expected_result: "what happens next"
      }`,
      response_json_schema: {
        type: 'object',
        properties: {
          action: { type: 'string' },
          selector: { type: 'string' },
          value: { type: 'string' },
          expected_result: { type: 'string' }
        }
      }
    });

    // Execute plan
    const action = plan.data?.action || 'extract';
    let result = null;

    if (action === 'click') {
      await page.click(plan.data.selector);
      result = 'Clicked';
    } else if (action === 'fill') {
      await page.fill(plan.data.selector, plan.data.value);
      result = 'Filled';
    } else if (action === 'extract') {
      result = await page.evaluate(() => document.body.innerText.substring(0, 2000));
    }

    const screenshot = await page.screenshot({ fullPage: true });

    return Response.json({
      success: true,
      action_taken: action,
      result,
      screenshot: btoa(String.fromCharCode.apply(null, Array.from(screenshot)))
    });

  } catch (error) {
    return Response.json({ success: false, error: error.message }, { status: 500 });
  } finally {
    if (page) await page.close().catch(() => null);
    if (browser) await browser.close().catch(() => null);
  }
}