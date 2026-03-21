/**
 * Instant Task — Real browser automation via Browserbase
 * Spins up a real cloud browser session, navigates to a URL,
 * uses AI to understand the page, fills forms, and submits.
 * Supports: logo gigs, content audits, digital asset creation.
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';
import OpenAI from 'npm:openai@4.47.1';

const BROWSERBASE_API_KEY = Deno.env.get('BROWSERBASE_API_KEY');
const BROWSERBASE_PROJECT_ID = Deno.env.get('BROWSERBASE_PROJECT_ID');
const BB_BASE = 'https://www.browserbase.com/v1';

let _openai = null;
function getOpenAI() {
  if (!_openai) _openai = new OpenAI({ apiKey: Deno.env.get('OPENAI_API_KEY') });
  return _openai;
}

async function llm(messages, maxTokens = 1200) {
  try {
    const res = await getOpenAI().chat.completions.create({
      model: 'gpt-4o',
      messages,
      max_tokens: maxTokens,
    });
    return res.choices[0].message.content;
  } catch (_e) {
    // fallback handled by caller
    return null;
  }
}

// ── Browserbase helpers ───────────────────────────────────────────────────────

async function createSession() {
  const res = await fetch(`${BB_BASE}/sessions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-BB-API-Key': BROWSERBASE_API_KEY,
    },
    body: JSON.stringify({ projectId: BROWSERBASE_PROJECT_ID }),
  });
  if (!res.ok) throw new Error(`BB create session failed: ${res.status} ${await res.text()}`);
  return res.json(); // { id, debuggerFullscreenUrl, ... }
}

async function stopSession(sessionId) {
  await fetch(`${BB_BASE}/sessions/${sessionId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', 'X-BB-API-Key': BROWSERBASE_API_KEY },
    body: JSON.stringify({ status: 'REQUEST_RELEASE' }),
  });
}

async function runPageScript(sessionId, script) {
  const res = await fetch(`${BB_BASE}/sessions/${sessionId}/execute`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-BB-API-Key': BROWSERBASE_API_KEY },
    body: JSON.stringify({ script }),
  });
  if (!res.ok) throw new Error(`BB execute failed: ${res.status} ${await res.text()}`);
  return res.json();
}

async function navigateTo(sessionId, url) {
  return runPageScript(sessionId, `
    await page.goto(${JSON.stringify(url)}, { waitUntil: 'domcontentloaded', timeout: 20000 });
    return await page.content();
  `);
}

async function getPageSnapshot(sessionId) {
  return runPageScript(sessionId, `
    const html = await page.content();
    const title = await page.title();
    const url = page.url();
    // Extract visible text + form fields
    const text = await page.evaluate(() => document.body?.innerText?.slice(0, 4000) || '');
    const fields = await page.evaluate(() => {
      const inputs = [...document.querySelectorAll('input,textarea,select')];
      return inputs.map(el => ({
        tag: el.tagName.toLowerCase(),
        type: el.type || '',
        name: el.name || el.id || el.placeholder || '',
        placeholder: el.placeholder || '',
        label: el.labels?.[0]?.textContent?.trim() || '',
        required: el.required,
      }));
    });
    return { title, url, text, fields };
  `);
}

async function fillAndSubmit(sessionId, fieldInstructions) {
  // fieldInstructions: array of { selector, value, action }
  const script = `
    const instructions = ${JSON.stringify(fieldInstructions)};
    for (const inst of instructions) {
      try {
        if (inst.action === 'click') {
          await page.click(inst.selector, { timeout: 5000 });
        } else if (inst.action === 'type') {
          await page.fill(inst.selector, inst.value, { timeout: 5000 });
        } else if (inst.action === 'select') {
          await page.selectOption(inst.selector, inst.value, { timeout: 5000 });
        }
      } catch(e) { /* skip field if not found */ }
    }
    // Wait briefly for any dynamic updates
    await page.waitForTimeout(800);
    const finalUrl = page.url();
    const finalTitle = await page.title();
    const bodyText = await page.evaluate(() => document.body?.innerText?.slice(0, 2000) || '');
    return { finalUrl, finalTitle, bodyText };
  `;
  return runPageScript(sessionId, script);
}

async function takeScreenshot(sessionId) {
  return runPageScript(sessionId, `
    const buf = await page.screenshot({ type: 'png', fullPage: false });
    return { screenshot: buf.toString('base64') };
  `);
}

// ── Task type executors ───────────────────────────────────────────────────────

async function executeInstantTask(base44, payload, log) {
  const { task_type, url, context, identity } = payload;

  if (!BROWSERBASE_API_KEY || !BROWSERBASE_PROJECT_ID) {
    throw new Error('Browserbase credentials not configured. Set BROWSERBASE_API_KEY and BROWSERBASE_PROJECT_ID.');
  }

  log('session_start', 'Creating Browserbase cloud browser session...');
  const session = await createSession();
  const sessionId = session.id;
  log('session_ready', `Session ${sessionId} created`);

  try {
    // Step 1: Navigate
    log('navigate', `Navigating to ${url}`);
    await navigateTo(sessionId, url);

    // Step 2: Snapshot the page
    log('analyze', 'Reading page structure and form fields...');
    const snapshotResult = await getPageSnapshot(sessionId);
    const snapshot = snapshotResult?.result || snapshotResult;

    log('snapshot_done', `Page: "${snapshot.title}" — ${(snapshot.fields || []).length} fields detected`);

    // Step 3: AI decides what to fill
    log('ai_plan', 'AI generating fill instructions...');
    const aiPrompt = buildAIPrompt(task_type, snapshot, context, identity);
    const aiResponse = await llm([
      { role: 'system', content: 'You are a browser automation expert. Return ONLY valid JSON.' },
      { role: 'user', content: aiPrompt },
    ], 1000);

    let fillPlan = null;
    try { fillPlan = JSON.parse(aiResponse); } catch (_) { /* use fallback */ }

    const instructions = fillPlan?.instructions || buildFallbackInstructions(task_type, snapshot, context, identity);
    const deliverable = fillPlan?.deliverable || '';

    log('fill_start', `Executing ${instructions.length} field instructions...`);
    const fillResult = await fillAndSubmit(sessionId, instructions);
    const fill = fillResult?.result || fillResult;

    log('fill_done', `Page after fill: "${fill.finalTitle}" at ${fill.finalUrl}`);

    // Step 4: Detect success
    const successSignals = ['thank', 'success', 'submitted', 'confirmation', 'received', 'complete'];
    const bodyLower = (fill.bodyText || '').toLowerCase();
    const submitted = successSignals.some(s => bodyLower.includes(s));

    log('result', submitted ? '✅ Submission detected' : '⚠️ Manual review may be needed');

    return {
      success: true,
      submitted,
      session_id: sessionId,
      debug_url: session.debuggerFullscreenUrl || null,
      final_url: fill.finalUrl,
      deliverable,
      snapshot_title: snapshot.title,
      fields_found: (snapshot.fields || []).length,
      instructions_executed: instructions.length,
      message: submitted
        ? `Successfully submitted "${snapshot.title}" via real browser session.`
        : `Browser session completed. Page: "${fill.finalTitle}". Check ${fill.finalUrl} to confirm submission.`,
    };
  } finally {
    await stopSession(sessionId).catch(() => {});
    log('session_closed', 'Browser session released');
  }
}

function buildAIPrompt(task_type, snapshot, context, identity) {
  return `You are filling out a form on this page for a "${task_type}" instant task.

Page title: ${snapshot.title}
Page URL: ${snapshot.url}
Page content preview: ${(snapshot.text || '').slice(0, 1500)}

Detected form fields: ${JSON.stringify(snapshot.fields || [], null, 2)}

Identity to use:
- Name: ${identity?.name || 'Alex Jordan'}
- Skills: ${(identity?.skills || ['design', 'writing', 'content']).join(', ')}
- Email: ${identity?.email || 'alex@example.com'}
- Bio: ${identity?.bio || 'Professional freelancer with 5+ years experience'}

Task context / brief: ${context || 'Complete this task with high quality professional output'}

Return a JSON object with:
{
  "instructions": [
    { "action": "type"|"click"|"select", "selector": "CSS selector", "value": "value to type" }
  ],
  "deliverable": "A short description of what was submitted / created"
}

Use CSS selectors like input[name='email'], textarea, input[type='submit'], button[type='submit'].
For submit buttons use action "click" with value "".
Keep it to essential fields only. Skip file uploads.`;
}

function buildFallbackInstructions(task_type, snapshot, context, identity) {
  const instructions = [];
  const fields = snapshot?.fields || [];
  const name = identity?.name || 'Alex Jordan';
  const email = identity?.email || 'alex@example.com';

  for (const f of fields) {
    const label = (f.label + f.name + f.placeholder).toLowerCase();
    let value = null;
    let selector = f.name ? `[name="${f.name}"]` : (f.tag === 'textarea' ? 'textarea' : null);
    if (!selector) continue;

    if (label.includes('email')) value = email;
    else if (label.includes('name')) value = name;
    else if (label.includes('title') || label.includes('subject')) value = `${task_type} submission - ${name}`;
    else if (f.tag === 'textarea') value = context || `Professional ${task_type} delivered by ${name}. Skills: ${(identity?.skills || []).join(', ')}.`;
    else if (f.type === 'text') value = name;

    if (value) instructions.push({ action: 'type', selector, value });
  }

  // Try to click submit
  instructions.push({ action: 'click', selector: 'button[type="submit"], input[type="submit"], button:has-text("Submit"), button:has-text("Apply"), button:has-text("Send")', value: '' });
  return instructions;
}

// ── Main handler ──────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { action, payload } = body;

    if (action === 'run_instant_task') {
      const execLog = [];
      const log = (step, detail) => {
        execLog.push({ timestamp: new Date().toISOString(), step, detail });
        console.log(`[InstantTask] ${step}: ${detail}`);
      };

      const result = await executeInstantTask(base44, payload, log);

      // Update task record if task_id provided
      if (payload.task_id) {
        await base44.asServiceRole.entities.TaskExecutionQueue.update(payload.task_id, {
          status: result.submitted ? 'completed' : 'needs_review',
          completion_timestamp: new Date().toISOString(),
          submission_success: result.submitted,
          confirmation_text: result.message,
          deep_link_for_manual: result.final_url,
          execution_log: execLog,
          needs_manual_review: !result.submitted,
          manual_review_reason: result.submitted ? null : 'Instant task completed but submission confirmation pending',
          execution_time_seconds: Math.round((Date.now() - (payload.start_time || Date.now())) / 1000),
        }).catch(err => console.error('Task update failed:', err.message));
      }

      // Update opportunity if opportunity_id provided
      if (payload.opportunity_id) {
        await base44.asServiceRole.entities.Opportunity.update(payload.opportunity_id, {
          status: result.submitted ? 'submitted' : 'reviewing',
          submission_timestamp: new Date().toISOString(),
          submission_confirmed: result.submitted,
          notes: result.message,
          confirmation_number: result.submitted ? `INSTANT-${new Date().getTime()}` : null,
        }).catch(err => console.error('Opportunity update failed:', err.message));
      }

      // Activity log
      await base44.asServiceRole.entities.ActivityLog.create({
        action_type: result.submitted ? 'opportunity_found' : 'alert',
        message: `[InstantTask] ${result.submitted ? '✅ Submitted' : '⚠️ Review needed'}: ${payload.task_type} at ${payload.url}`,
        severity: result.submitted ? 'success' : 'warning',
        metadata: { 
          session_id: result.session_id, 
          task_type: payload.task_type,
          task_id: payload.task_id,
          opportunity_id: payload.opportunity_id,
          submitted: result.submitted,
          fields_found: result.fields_found,
          instructions_executed: result.instructions_executed
        },
      }).catch(err => console.error('ActivityLog creation failed:', err.message));

      return Response.json({ success: true, ...result, execution_log: execLog, task_id: payload.task_id });
    }

    if (action === 'list_task_types') {
      return Response.json({
        success: true,
        task_types: [
          { id: 'logo_generation',     label: 'Logo Generation',       desc: 'Submit AI-designed logo brief to contest platforms' },
          { id: 'content_audit',       label: 'Content Audit',         desc: 'Submit content audit report to clients/platforms' },
          { id: 'digital_asset',       label: 'Digital Asset Upload',  desc: 'Upload templates, icons, or fonts to marketplaces' },
          { id: 'grant_application',   label: 'Grant Application',     desc: 'Fill and submit grant application forms' },
          { id: 'freelance_apply',     label: 'Freelance Apply',       desc: 'Apply to freelance gigs on PeoplePerHour, Guru, etc.' },
          { id: 'contest_entry',       label: 'Contest Entry',         desc: 'Enter design or writing contests' },
          { id: 'giveaway_entry',      label: 'Giveaway Entry',        desc: 'Fill and submit sweepstakes/giveaway forms' },
        ],
      });
    }

    return Response.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error) {
    console.error('[InstantTask] Fatal:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});