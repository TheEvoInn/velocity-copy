/**
 * CAPTCHA Solver Service
 * Detects and solves various CAPTCHA types (reCAPTCHA, hCaptcha, image, etc.)
 * Integrates with 2captcha, Anti-Captcha, or custom service
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

    // ACTION: Detect CAPTCHA on page
    if (action === 'detect_captcha') {
      const { page_html, page_url } = payload;

      const detection = {
        detected: false,
        captcha_types: [],
        details: [],
        confidence: 0,
        solveable: false
      };

      // Detect reCAPTCHA v2
      if (page_html.includes('g-recaptcha') || page_html.includes('recaptcha')) {
        const sitekeyMatch = page_html.match(/data-sitekey=["']([^"']+)["']/);
        if (sitekeyMatch) {
          detection.detected = true;
          detection.captcha_types.push('recaptcha_v2');
          detection.details.push({
            type: 'recaptcha_v2',
            sitekey: sitekeyMatch[1],
            page_url,
            confidence: 0.98
          });
          detection.solveable = true;
          detection.confidence = 0.98;
        }
      }

      // Detect reCAPTCHA v3
      if (page_html.includes('grecaptcha') && page_html.includes('execute')) {
        const sitekeyMatch = page_html.match(/grecaptcha\.execute\(["']([^"']+)["']/);
        if (sitekeyMatch) {
          detection.detected = true;
          detection.captcha_types.push('recaptcha_v3');
          detection.details.push({
            type: 'recaptcha_v3',
            sitekey: sitekeyMatch[1],
            page_url,
            confidence: 0.95
          });
          detection.solveable = true;
          detection.confidence = Math.max(detection.confidence, 0.95);
        }
      }

      // Detect hCaptcha
      if (page_html.includes('h-captcha') || page_html.includes('hcaptcha')) {
        const sitekeyMatch = page_html.match(/data-sitekey=["']([^"']+)["']/);
        if (sitekeyMatch) {
          detection.detected = true;
          detection.captcha_types.push('hcaptcha');
          detection.details.push({
            type: 'hcaptcha',
            sitekey: sitekeyMatch[1],
            page_url,
            confidence: 0.97
          });
          detection.solveable = true;
          detection.confidence = Math.max(detection.confidence, 0.97);
        }
      }

      // Detect image CAPTCHA
      if (page_html.includes('captcha') && page_html.includes('img')) {
        const captchaImgPattern = /<img[^>]*(?:id|name|alt|src)[^>]*captcha[^>]*>/i;
        if (captchaImgPattern.test(page_html)) {
          detection.detected = true;
          detection.captcha_types.push('image_captcha');
          detection.details.push({
            type: 'image_captcha',
            page_url,
            confidence: 0.75
          });
          detection.solveable = true;
          detection.confidence = Math.max(detection.confidence, 0.75);
        }
      }

      // Detect Cloudflare Challenge
      if (page_html.includes('challenge') && page_html.includes('cloudflare')) {
        detection.detected = true;
        detection.captcha_types.push('cloudflare_challenge');
        detection.details.push({
          type: 'cloudflare_challenge',
          page_url,
          confidence: 0.92
        });
        detection.solveable = false; // Requires special handling
        detection.confidence = Math.max(detection.confidence, 0.92);
      }

      // Detect Google reCAPTCHA Enterprise
      if (page_html.includes('recaptcha/enterprise')) {
        detection.detected = true;
        detection.captcha_types.push('recaptcha_enterprise');
        detection.details.push({
          type: 'recaptcha_enterprise',
          page_url,
          confidence: 0.96
        });
        detection.solveable = true;
        detection.confidence = Math.max(detection.confidence, 0.96);
      }

      // Detect Arkose (Funcaptcha)
      if (page_html.includes('arkose') || page_html.includes('funcaptcha')) {
        detection.detected = true;
        detection.captcha_types.push('arkose');
        detection.details.push({
          type: 'arkose',
          page_url,
          confidence: 0.88
        });
        detection.solveable = true;
        detection.confidence = Math.max(detection.confidence, 0.88);
      }

      // Log detection
      if (detection.detected) {
        await base44.entities.ActivityLog.create({
          action_type: 'scan',
          message: `CAPTCHA detected: ${detection.captcha_types.join(', ')}`,
          metadata: {
            url: page_url,
            types: detection.captcha_types,
            solveable: detection.solveable,
            confidence: detection.confidence
          },
          severity: detection.solveable ? 'info' : 'warning'
        });
      }

      return Response.json({
        status: 'success',
        detection
      });
    }

    // ACTION: Solve CAPTCHA via 2captcha
    if (action === 'solve_captcha_2captcha') {
      const { captcha_type, sitekey, page_url, task_id } = payload;
      const apiKey = Deno.env.get('CAPTCHA_2CAPTCHA_API_KEY');

      if (!apiKey) {
        return Response.json({ error: 'CAPTCHA service not configured' }, { status: 400 });
      }

      let formData = new FormData();
      formData.append('clientkey', apiKey);
      formData.append('task_type', 'NoCaptchaTaskProxyless');
      formData.append('websiteURL', page_url);
      formData.append('websiteKey', sitekey);

      // Map captcha type to 2captcha parameters
      if (captcha_type === 'recaptcha_v3') {
        formData.append('minScore', '0.3');
      } else if (captcha_type === 'hcaptcha') {
        formData.append('websiteKey', sitekey);
      }

      try {
        const response = await fetch('https://api.2captcha.com/createTask', {
          method: 'POST',
          body: formData
        });

        const data = await response.json();

        if (data.taskId) {
          // Poll for solution
          let solution = null;
          let attempts = 0;
          const maxAttempts = 60; // 5 minutes with 5s intervals

          while (attempts < maxAttempts && !solution) {
            await new Promise(r => setTimeout(r, 5000)); // Wait 5 seconds

            const resultForm = new FormData();
            resultForm.append('clientkey', apiKey);
            resultForm.append('taskId', data.taskId);

            const resultResponse = await fetch('https://api.2captcha.com/getTaskResult', {
              method: 'POST',
              body: resultForm
            });

            const resultData = await resultResponse.json();

            if (resultData.solution) {
              solution = resultData.solution;
              break;
            }

            attempts++;
          }

          if (solution) {
            // Log successful solve
            await base44.entities.ActivityLog.create({
              action_type: 'system',
              message: `CAPTCHA solved: ${captcha_type}`,
              metadata: {
                url: page_url,
                type: captcha_type,
                task_id,
                solving_time_seconds: attempts * 5
              },
              severity: 'info'
            });

            return Response.json({
              status: 'success',
              solution: solution.gRecaptchaResponse,
              captcha_type,
              solving_time_seconds: attempts * 5
            });
          } else {
            return Response.json({
              status: 'error',
              message: 'CAPTCHA solving timeout',
              error_code: 'TIMEOUT'
            }, { status: 408 });
          }
        } else {
          return Response.json({
            status: 'error',
            message: 'Failed to create solve task',
            error: data.error
          }, { status: 400 });
        }
      } catch (err) {
        console.error('2captcha error:', err);
        return Response.json({
          status: 'error',
          message: 'CAPTCHA service error',
          error: err.message
        }, { status: 500 });
      }
    }

    // ACTION: Solve CAPTCHA via Anti-Captcha
    if (action === 'solve_captcha_anticaptcha') {
      const { captcha_type, sitekey, page_url, task_id } = payload;
      const apiKey = Deno.env.get('CAPTCHA_ANTICAPTCHA_API_KEY');

      if (!apiKey) {
        return Response.json({ error: 'CAPTCHA service not configured' }, { status: 400 });
      }

      const taskData = {
        clientKey: apiKey,
        task: {
          type: captcha_type === 'hcaptcha' ? 'HCaptchaTaskProxyless' : 'NoCaptchaTaskProxyless',
          websiteURL: page_url,
          websiteKey: sitekey
        }
      };

      try {
        const response = await fetch('https://api.anti-captcha.com/createTask', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(taskData)
        });

        const data = await response.json();

        if (data.taskId) {
          // Poll for solution
          let solution = null;
          let attempts = 0;

          while (attempts < 60 && !solution) {
            await new Promise(r => setTimeout(r, 5000));

            const resultResponse = await fetch('https://api.anti-captcha.com/getTaskResult', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                clientKey: apiKey,
                taskId: data.taskId
              })
            });

            const resultData = await resultResponse.json();

            if (resultData.solution) {
              solution = resultData.solution;
              break;
            }

            attempts++;
          }

          if (solution) {
            await base44.entities.ActivityLog.create({
              action_type: 'system',
              message: `CAPTCHA solved via Anti-Captcha: ${captcha_type}`,
              metadata: {
                url: page_url,
                type: captcha_type,
                solving_time_seconds: attempts * 5
              },
              severity: 'info'
            });

            return Response.json({
              status: 'success',
              solution: solution.gRecaptchaResponse,
              captcha_type,
              solving_time_seconds: attempts * 5
            });
          }
        }

        return Response.json({ status: 'error', message: 'Unable to solve CAPTCHA' }, { status: 400 });
      } catch (err) {
        console.error('Anti-Captcha error:', err);
        return Response.json({ status: 'error', message: err.message }, { status: 500 });
      }
    }

    // ACTION: Handle CAPTCHA in Task Reader context
    if (action === 'handle_task_reader_captcha') {
      const { task_id, detection, auto_solve } = payload;

      // Store CAPTCHA encounter record
      await base44.entities.ExternalTaskAnalysis.update(task_id, {
        execution_log: [
          ...(payload.execution_log || []),
          {
            timestamp: new Date().toISOString(),
            step: 'captcha_detected',
            status: detection.solveable && auto_solve ? 'solving' : 'blocked',
            details: `${detection.captcha_types.join(', ')} detected`,
            confidence: detection.confidence
          }
        ],
        understanding: {
          blockers: [
            ...(payload.blockers || []),
            `${detection.captcha_types[0]}: ${detection.solveable ? 'Can auto-solve' : 'Manual intervention required'}`
          ]
        }
      });

      return Response.json({
        status: 'success',
        detection,
        auto_solve_enabled: auto_solve && detection.solveable,
        action: detection.solveable && auto_solve ? 'auto_solve' : 'manual_intervention'
      });
    }

    return Response.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error) {
    console.error('CAPTCHA solver error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});