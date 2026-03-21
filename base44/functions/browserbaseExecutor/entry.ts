import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

const BROWSERBASE_API_KEY = Deno.env.get('BROWSERBASE_API_KEY');
const BROWSERBASE_PROJECT_ID = Deno.env.get('BROWSERBASE_PROJECT_ID');

async function createBrowserSession() {
  const response = await fetch('https://api.browserbase.com/v1/sessions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${BROWSERBASE_API_KEY}`,
      'X-Browserbase-Project': BROWSERBASE_PROJECT_ID,
    },
    body: JSON.stringify({
      keep_alive: 30,
    }),
  });

  if (!response.ok) throw new Error('Failed to create browser session');
  const data = await response.json();
  return data.id;
}

async function navigateToUrl(sessionId, url) {
  const response = await fetch(`https://api.browserbase.com/v1/sessions/${sessionId}/goto`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${BROWSERBASE_API_KEY}`,
    },
    body: JSON.stringify({ url }),
  });

  if (!response.ok) throw new Error('Failed to navigate');
  return await response.json();
}

async function identifyFormFields(sessionId) {
  const response = await fetch(`https://api.browserbase.com/v1/sessions/${sessionId}/execute`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${BROWSERBASE_API_KEY}`,
    },
    body: JSON.stringify({
      code: `
        const fields = [];
        document.querySelectorAll('input, textarea, select').forEach(el => {
          if (!el.disabled && el.offsetParent) {
            fields.push({
              id: el.id || el.name,
              name: el.name,
              type: el.type,
              placeholder: el.placeholder,
              label: document.querySelector(\`label[for="\${el.id}"]\`)?.textContent,
              required: el.required,
              value: el.value,
            });
          }
        });
        return fields;
      `,
    }),
  });

  if (!response.ok) throw new Error('Failed to identify fields');
  const data = await response.json();
  return data.result || [];
}

async function fillFormField(sessionId, fieldName, value) {
  const response = await fetch(`https://api.browserbase.com/v1/sessions/${sessionId}/execute`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${BROWSERBASE_API_KEY}`,
    },
    body: JSON.stringify({
      code: `
        const field = document.querySelector(\`[name="\${fieldName}"]\`) || 
                     document.querySelector(\`#\${fieldName}\`);
        if (field) {
          field.focus();
          field.value = "${value.replace(/"/g, '\\"')}";
          field.dispatchEvent(new Event('input', { bubbles: true }));
          field.dispatchEvent(new Event('change', { bubbles: true }));
          return { success: true };
        }
        return { success: false, error: 'Field not found' };
      `,
    }),
  });

  if (!response.ok) throw new Error('Failed to fill field');
  return await response.json();
}

async function clickSubmitButton(sessionId) {
  const response = await fetch(`https://api.browserbase.com/v1/sessions/${sessionId}/execute`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${BROWSERBASE_API_KEY}`,
    },
    body: JSON.stringify({
      code: `
        const btn = document.querySelector('button[type="submit"]') ||
                   document.querySelector('input[type="submit"]') ||
                   document.querySelector('button:contains("Submit")') ||
                   document.querySelector('button:contains("Continue")');
        if (btn) {
          btn.click();
          return { success: true };
        }
        return { success: false, error: 'Submit button not found' };
      `,
    }),
  });

  if (!response.ok) throw new Error('Failed to click submit');
  return await response.json();
}

async function takeScreenshot(sessionId) {
  const response = await fetch(`https://api.browserbase.com/v1/sessions/${sessionId}/screenshot`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${BROWSERBASE_API_KEY}`,
    },
  });

  if (!response.ok) throw new Error('Failed to take screenshot');
  return await response.arrayBuffer();
}

async function closeBrowserSession(sessionId) {
  await fetch(`https://api.browserbase.com/v1/sessions/${sessionId}`, {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${BROWSERBASE_API_KEY}`,
    },
  });
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { action, task_id, form_data = {} } = body;

    if (action === 'execute_task') {
      const task = await base44.entities.TaskExecutionQueue.filter({
        id: task_id,
        created_by: user.email,
      });

      if (!task || task.length === 0) {
        return Response.json({ error: 'Task not found' }, { status: 404 });
      }

      const taskRecord = task[0];
      let sessionId;
      const logs = taskRecord.execution_log || [];

      try {
        // Create browser session
        sessionId = await createBrowserSession();
        logs.push({
          timestamp: new Date().toISOString(),
          step: 'browser_session_created',
          status: 'completed',
          details: `Session ID: ${sessionId}`,
        });

        // Navigate to URL
        await navigateToUrl(sessionId, taskRecord.url);
        logs.push({
          timestamp: new Date().toISOString(),
          step: 'navigate_to_url',
          status: 'completed',
          details: `Navigated to ${taskRecord.url}`,
        });

        // Identify form fields
        const fields = await identifyFormFields(sessionId);
        logs.push({
          timestamp: new Date().toISOString(),
          step: 'identify_fields',
          status: 'completed',
          details: `Found ${fields.length} form fields`,
        });

        // Map form data to fields
        const mappedData = form_data || {};
        const fillResults = {};

        for (const [fieldName, fieldValue] of Object.entries(mappedData)) {
          try {
            const result = await fillFormField(sessionId, fieldName, String(fieldValue));
            fillResults[fieldName] = result?.result?.success ? 'filled' : 'failed';
          } catch (e) {
            fillResults[fieldName] = 'error';
          }
        }

        logs.push({
          timestamp: new Date().toISOString(),
          step: 'fill_form_fields',
          status: 'completed',
          details: `Filled ${Object.values(fillResults).filter(v => v === 'filled').length} fields`,
        });

        // Click submit
        const submitResult = await clickSubmitButton(sessionId);
        logs.push({
          timestamp: new Date().toISOString(),
          step: 'click_submit',
          status: submitResult?.result?.success ? 'completed' : 'failed',
          details: submitResult?.result?.error || 'Submit clicked',
        });

        // Take final screenshot
        const screenshot = await takeScreenshot(sessionId);
        logs.push({
          timestamp: new Date().toISOString(),
          step: 'take_screenshot',
          status: 'completed',
          details: 'Final screenshot captured',
        });

        // Update task
        await base44.entities.TaskExecutionQueue.update(task_id, {
          status: 'completed',
          submission_success: submitResult?.result?.success || false,
          execution_log: logs,
          completion_timestamp: new Date().toISOString(),
        });

        return Response.json({
          status: 'completed',
          session_id: sessionId,
          fields_identified: fields.length,
          fields_filled: Object.values(fillResults).filter(v => v === 'filled').length,
          submit_success: submitResult?.result?.success || false,
          logs,
        });
      } catch (error) {
        logs.push({
          timestamp: new Date().toISOString(),
          step: 'execution_error',
          status: 'failed',
          details: error.message,
        });

        await base44.entities.TaskExecutionQueue.update(task_id, {
          status: 'failed',
          error_message: error.message,
          error_type: 'execution_error',
          execution_log: logs,
        });

        return Response.json({
          status: 'failed',
          error: error.message,
          logs,
        }, { status: 500 });
      } finally {
        if (sessionId) {
          await closeBrowserSession(sessionId);
        }
      }
    }

    if (action === 'batch_execute') {
      const tasks = await base44.entities.TaskExecutionQueue.filter({
        status: 'queued',
        created_by: user.email,
      }, '-priority', 5);

      const results = [];
      for (const task of tasks) {
        const res = await Deno.fetch(`${new URL(req.url).origin}/browserbaseExecutor`, {
          method: 'POST',
          headers: req.headers,
          body: JSON.stringify({
            action: 'execute_task',
            task_id: task.id,
            form_data: task.form_data_submitted || {},
          }),
        });

        const result = await res.json();
        results.push({ task_id: task.id, ...result });
      }

      return Response.json({ executed: results.length, results });
    }

    return Response.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    console.error('Browserbase error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});