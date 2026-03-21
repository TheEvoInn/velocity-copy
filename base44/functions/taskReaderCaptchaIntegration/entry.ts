/**
 * Task Reader CAPTCHA Integration
 * Seamlessly detects and handles CAPTCHAs during task execution
 */

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user?.email) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { action, payload } = await req.json();

    // ACTION: Analyze page and handle any CAPTCHAs
    if (action === 'analyze_and_solve') {
      const { url, page_html, task_id, auto_solve_enabled } = payload;

      // Step 1: Detect CAPTCHA
      const detectRes = await base44.functions.invoke('captchaSolver', {
        action: 'detect_captcha',
        payload: {
          page_html,
          page_url: url
        }
      });

      if (detectRes.data.status !== 'success') {
        return Response.json(detectRes.data, { status: detectRes.status });
      }

      const detection = detectRes.data.detection;

      // Step 2: Handle based on type and settings
      if (!detection.detected) {
        return Response.json({
          status: 'success',
          captcha_found: false,
          can_continue: true
        });
      }

      // Step 3: Determine solving strategy
      const solveStrategy = determineSolveStrategy(detection);

      // Step 4: Attempt to solve if enabled
      let solution = null;
      let solveError = null;

      if (auto_solve_enabled && detection.solveable && solveStrategy.service) {
        try {
          const solveRes = await solveCaptcha(base44, solveStrategy, {
            page_url: url,
            task_id
          });

          if (solveRes.status === 'success') {
            solution = solveRes.solution;
          } else {
            solveError = solveRes.message;
          }
        } catch (err) {
          solveError = err.message;
        }
      }

      // Log the encounter
      if (task_id) {
        await base44.entities.ExternalTaskAnalysis.update(task_id, {
          metadata: {
            captcha_encountered: true,
            captcha_types: detection.captcha_types,
            captcha_solved: solution ? true : false
          }
        });
      }

      return Response.json({
        status: 'success',
        captcha_found: true,
        detection,
        solution,
        can_continue: solution ? true : false,
        solve_error: solveError,
        requires_manual: detection.solveable ? false : true
      });
    }

    // ACTION: Get injection script with CAPTCHA solver
    if (action === 'generate_captcha_aware_injector') {
      const { captcha_details, form_selector } = payload;

      const script = generateCaptchaAwareScript(captcha_details, form_selector);

      return Response.json({
        status: 'success',
        injector_script: script
      });
    }

    return Response.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error) {
    console.error('Task Reader CAPTCHA Integration error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});

/**
 * Determine which CAPTCHA solving service to use
 */
function determineSolveStrategy(detection) {
  const has2Captcha = !!Deno.env.get('CAPTCHA_2CAPTCHA_API_KEY');
  const hasAntiCaptcha = !!Deno.env.get('CAPTCHA_ANTICAPTCHA_API_KEY');

  const primaryType = detection.captcha_types[0];

  // Determine best service for this CAPTCHA type
  let service = null;

  if (has2Captcha) {
    service = '2captcha';
  } else if (hasAntiCaptcha) {
    service = 'anticaptcha';
  }

  return {
    service,
    captcha_type: primaryType,
    solveable: detection.solveable,
    confidence: detection.confidence,
    priority: getPriorityFor(primaryType)
  };
}

/**
 * Get priority/reliability for CAPTCHA type
 */
function getPriorityFor(type) {
  const priorities = {
    recaptcha_v2: 95,
    hcaptcha: 94,
    recaptcha_v3: 90,
    recaptcha_enterprise: 92,
    image_captcha: 75,
    arkose: 80,
    cloudflare_challenge: 20
  };
  return priorities[type] || 50;
}

/**
 * Solve CAPTCHA using selected service
 */
async function solveCaptcha(base44, strategy, context) {
  if (!strategy.service || !strategy.solveable) {
    return {
      status: 'error',
      message: 'Service not available or CAPTCHA not solveable'
    };
  }

  const { captcha_type, page_url, task_id } = context;

  try {
    if (strategy.service === '2captcha') {
      return await base44.functions.invoke('captchaSolver', {
        action: 'solve_captcha_2captcha',
        payload: {
          captcha_type,
          sitekey: context.sitekey || 'auto_detect',
          page_url,
          task_id
        }
      });
    } else if (strategy.service === 'anticaptcha') {
      return await base44.functions.invoke('captchaSolver', {
        action: 'solve_captcha_anticaptcha',
        payload: {
          captcha_type,
          sitekey: context.sitekey || 'auto_detect',
          page_url,
          task_id
        }
      });
    }
  } catch (err) {
    return {
      status: 'error',
      message: `CAPTCHA solving service error: ${err.message}`
    };
  }
}

/**
 * Generate injection script that handles CAPTCHAs
 */
function generateCaptchaAwareScript(captchaDetails, formSelector) {
  return `
(function() {
  const captchaConfig = ${JSON.stringify(captchaDetails)};
  
  window.__velocityCaptchaHandler = {
    config: captchaConfig,
    isSolving: false,
    solutions: {},
    
    async handleRecaptchaV2(callback) {
      if (this.isSolving) return;
      this.isSolving = true;
      
      try {
        const response = await window.fetch('/api/solve-captcha', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'recaptcha_v2',
            sitekey: this.config.sitekey
          })
        });
        
        const data = await response.json();
        if (data.solution) {
          this.solutions.recaptcha_v2 = data.solution;
          callback && callback(data.solution);
          return data.solution;
        }
      } catch (err) {
        console.error('CAPTCHA solve error:', err);
      } finally {
        this.isSolving = false;
      }
    },
    
    async injectSolution(token) {
      const form = document.querySelector('${formSelector}');
      if (!form) return false;
      
      const responseField = form.querySelector('textarea[name="g-recaptcha-response"]');
      if (responseField) {
        responseField.innerHTML = token;
        responseField.value = token;
        form.dispatchEvent(new Event('change'));
        return true;
      }
      return false;
    },
    
    async autoSolveAndInject() {
      const solution = await this.handleRecaptchaV2();
      if (solution) {
        await this.injectSolution(solution);
        const form = document.querySelector('${formSelector}');
        if (form) {
          setTimeout(() => form.submit(), 500);
        }
        return true;
      }
      return false;
    },
    
    waitForCaptcha() {
      const checkInterval = setInterval(() => {
        const captchaElement = document.querySelector('.g-recaptcha');
        if (captchaElement && !this.isSolving) {
          clearInterval(checkInterval);
          this.autoSolveAndInject();
        }
      }, 1000);
    }
  };
  
  // Auto-start if auto-solve enabled
  if (window.__velocityCaptchaHandler.config.auto_solve) {
    window.__velocityCaptchaHandler.waitForCaptcha();
  }
  
  // Expose for manual control
  window.dispatchEvent(new CustomEvent('velocity:captcha-ready'));
})();
`;
}