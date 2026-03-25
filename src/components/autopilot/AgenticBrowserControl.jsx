import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { AlertCircle, Zap, Monitor, CheckCircle } from 'lucide-react';

export default function AgenticBrowserControl({ task, onComplete }) {
  const [executing, setExecuting] = useState(false);
  const [steps, setSteps] = useState([]);
  const [screenshot, setScreenshot] = useState(null);
  const [error, setError] = useState(null);

  const handleExecuteSignup = async () => {
    setExecuting(true);
    setError(null);
    setSteps([]);
    setScreenshot(null);

    try {
      const res = await base44.functions.invoke('playwrightBrowserAutomation', {
        action: 'execute_signup_autonomous',
        url: task.url,
        email: task.credentials?.email,
        password: task.credentials?.password,
        full_name: task.credentials?.full_name
      });

      if (res.data?.steps) {
        setSteps(res.data.steps);
      }

      if (res.data?.screenshot) {
        setScreenshot(`data:image/png;base64,${res.data.screenshot}`);
      }

      if (!res.data?.success) {
        setError(res.data?.error || 'Execution failed');
        return;
      }

      // Task completed
      if (onComplete) {
        onComplete({
          success: true,
          final_url: res.data.final_url,
          confirmation: res.data.confirmation
        });
      }
    } catch (err) {
      setError(err.message);
      setSteps(prev => [...prev, `❌ Error: ${err.message}`]);
    } finally {
      setExecuting(false);
    }
  };

  const handleExtractFields = async () => {
    setExecuting(true);
    setError(null);
    setSteps(['Analyzing form...']);

    try {
      const res = await base44.functions.invoke('playwrightBrowserAutomation', {
        action: 'extract_form_fields',
        url: task.url
      });

      if (res.data?.success) {
        setSteps([
          `Found ${res.data.field_count} fields:`,
          ...res.data.fields.map(f => `- ${f.name} (${f.type})`)
        ]);
      } else {
        setError('Failed to extract fields');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setExecuting(false);
    }
  };

  return (
    <div className="space-y-4">
      <Card className="bg-slate-900/50 border-slate-700 p-6">
        <div className="flex items-start gap-3 mb-4">
          <Monitor className="w-5 h-5 text-cyan-400 mt-1 shrink-0" />
          <div className="flex-1">
            <h3 className="font-semibold text-white mb-1">Agentic Browser Automation</h3>
            <p className="text-xs text-slate-400">
              Self-hosted browser automation using Playwright. No API fees, real-time execution.
            </p>
          </div>
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/20 rounded p-3 mb-4 flex gap-2">
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
            <p className="text-xs text-red-300">{error}</p>
          </div>
        )}

        {steps.length > 0 && (
          <div className="bg-slate-800/50 rounded p-4 mb-4 space-y-2 max-h-60 overflow-y-auto font-mono text-xs">
            {steps.map((step, i) => (
              <div key={i} className={step.includes('✓') ? 'text-green-400' : step.includes('❌') ? 'text-red-400' : 'text-slate-300'}>
                {step}
              </div>
            ))}
          </div>
        )}

        {screenshot && (
          <div className="mb-4 border border-slate-700 rounded overflow-hidden">
            <img src={screenshot} alt="Execution screenshot" className="w-full h-auto" />
          </div>
        )}

        <div className="flex gap-2">
          <Button
            onClick={handleExecuteSignup}
            disabled={executing}
            className="flex-1 bg-cyan-600 hover:bg-cyan-700 gap-2"
          >
            <Zap className="w-4 h-4" />
            {executing ? 'Executing...' : 'Auto-Execute Signup'}
          </Button>
          <Button
            onClick={handleExtractFields}
            disabled={executing}
            variant="outline"
            className="flex-1"
          >
            Analyze Form
          </Button>
        </div>
      </Card>

      <div className="text-xs text-slate-500 space-y-1">
        <p>• Browser runs locally—no external APIs</p>
        <p>• Uses Playwright for headless automation</p>
        <p>• LLM analyzes form structure intelligently</p>
        <p>• Captures screenshots for verification</p>
      </div>
    </div>
  );
}