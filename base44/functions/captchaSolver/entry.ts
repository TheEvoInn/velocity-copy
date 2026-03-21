/**
 * CAPTCHA Solver Service
 * Detects and solves various CAPTCHA types
 */

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user?.email) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { action, payload } = body;

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

      // Check for reCAPTCHA v2
      if (page_html.includes('g-recaptcha')) {
        const match = page_html.match(/data-sitekey=["']([^"']+)["']/);
        if (match) {
          detection.detected = true;
          detection.captcha_types.push('recaptcha_v2');
          detection.details.push({
            type: 'recaptcha_v2',
            sitekey: match[1],
            confidence: 0.98
          });
          detection.solveable = true;
          detection.confidence = 0.98;
        }
      }

      // Check for reCAPTCHA v3
      if (page_html.includes('grecaptcha') && page_html.includes('execute')) {
        const match = page_html.match(/grecaptcha\.execute\(["']([^"']+)["']/);
        if (match) {
          detection.detected = true;
          detection.captcha_types.push('recaptcha_v3');
          detection.details.push({
            type: 'recaptcha_v3',
            sitekey: match[1],
            confidence: 0.95
          });
          detection.solveable = true;
          detection.confidence = Math.max(detection.confidence, 0.95);
        }
      }

      // Check for hCaptcha
      if (page_html.includes('h-captcha')) {
        const match = page_html.match(/data-sitekey=["']([^"']+)["']/);
        if (match) {
          detection.detected = true;
          detection.captcha_types.push('hcaptcha');
          detection.details.push({
            type: 'hcaptcha',
            sitekey: match[1],
            confidence: 0.97
          });
          detection.solveable = true;
          detection.confidence = Math.max(detection.confidence, 0.97);
        }
      }

      // Log detection
      if (detection.detected) {
        await base44.entities.ActivityLog.create({
          action_type: 'scan',
          message: `CAPTCHA detected: ${detection.captcha_types.join(', ')}`,
          metadata: {
            url: page_url,
            types: detection.captcha_types,
            confidence: detection.confidence
          },
          severity: 'info'
        });
      }

      return Response.json({
        status: 'success',
        detection
      });
    }

    // ACTION: Solve CAPTCHA via 2captcha API
    if (action === 'solve_captcha_2captcha') {
      const { captcha_type, sitekey, page_url, task_id } = payload;
      const apiKey = Deno.env.get('CAPTCHA_2CAPTCHA_API_KEY');

      if (!apiKey) {
        return Response.json(
          { error: 'CAPTCHA service not configured' },
          { status: 400 }
        );
      }

      try {
        // Create solve task
        const formData = new FormData();
        formData.append('clientkey', apiKey);
        formData.append('task_type', 'NoCaptchaTaskProxyless');
        formData.append('websiteURL', page_url);
        formData.append('websiteKey', sitekey);

        const createRes = await fetch('https://api.2captcha.com/createTask', {
          method: 'POST',
          body: formData
        });

        const createData = await createRes.json();

        if (!createData.taskId) {
          return Response.json(
            { status: 'error', message: 'Failed to create solve task' },
            { status: 400 }
          );
        }

        // Poll for solution
        let solution = null;
        let attempts = 0;
        const maxAttempts = 60;

        while (attempts < maxAttempts && !solution) {
          await new Promise(r => setTimeout(r, 5000));

          const resultForm = new FormData();
          resultForm.append('clientkey', apiKey);
          resultForm.append('taskId', createData.taskId);

          const resultRes = await fetch(
            'https://api.2captcha.com/getTaskResult',
            {
              method: 'POST',
              body: resultForm
            }
          );

          const resultData = await resultRes.json();

          if (resultData.solution?.gRecaptchaResponse) {
            solution = resultData.solution.gRecaptchaResponse;
            break;
          }

          attempts++;
        }

        if (solution) {
          return Response.json({
            status: 'success',
            solution,
            captcha_type,
            solving_time_seconds: attempts * 5
          });
        }

        return Response.json(
          {
            status: 'error',
            message: 'CAPTCHA solving timeout'
          },
          { status: 408 }
        );
      } catch (err) {
        return Response.json(
          { status: 'error', message: err.message },
          { status: 500 }
        );
      }
    }

    // ACTION: Handle CAPTCHA in Task Reader
    if (action === 'handle_task_reader_captcha') {
      const { task_id, detection, auto_solve } = payload;

      if (task_id && detection.detected) {
        await base44.entities.ActivityLog.create({
          action_type: 'system',
          message: `CAPTCHA encounter: ${detection.captcha_types.join(', ')}`,
          metadata: {
            task_id,
            types: detection.captcha_types,
            auto_solve,
            solveable: detection.solveable
          },
          severity: 'info'
        });
      }

      return Response.json({
        status: 'success',
        detection,
        auto_solve_enabled: auto_solve && detection.solveable,
        action: detection.solveable && auto_solve ? 'auto_solve' : 'manual'
      });
    }

    return Response.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});