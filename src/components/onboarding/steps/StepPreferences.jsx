import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ArrowRight, ArrowLeft, Sliders, Sparkles, Loader2 } from 'lucide-react';
import { base44 } from '@/api/base44Client';

const CATEGORIES = ['freelance', 'service', 'arbitrage', 'lead_gen', 'digital_flip', 'auction', 'resale', 'contest', 'giveaway', 'grant'];
const TIMEZONES = ['America/Los_Angeles', 'America/Chicago', 'America/New_York', 'America/Denver', 'Europe/London', 'Europe/Paris', 'Asia/Tokyo', 'Asia/Singapore', 'Australia/Sydney'];

function Toggle({ label, options, value, onChange }) {
  return (
    <div>
      <label className="text-[10px] text-slate-500 uppercase tracking-wider block mb-1">{label}</label>
      <div className="flex flex-wrap gap-1.5">
        {options.map(o => (
          <button key={o.value} type="button" onClick={() => onChange(o.value)}
            className={`px-2.5 py-1 rounded-lg text-xs border transition-colors ${value === o.value ? 'bg-cyan-600/20 border-cyan-500/40 text-cyan-300' : 'bg-slate-800 border-slate-700 text-slate-500 hover:text-slate-300'}`}>
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function CheckToggle({ label, checked, onChange }) {
  return (
    <label className="flex items-center justify-between cursor-pointer bg-slate-800 border border-slate-700 rounded-lg px-3 py-2.5">
      <span className="text-xs text-slate-300">{label}</span>
      <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} className="rounded accent-cyan-500" />
    </label>
  );
}

export default function StepPreferences({ data, onChange, onNext, onBack }) {
  const [generating, setGenerating] = useState(null);
  const set = (k, v) => onChange({ ...data, [k]: v });
  const toggleCat = (cat) => {
    const cats = data.preferred_categories || [];
    set('preferred_categories', cats.includes(cat) ? cats.filter(c => c !== cat) : [...cats, cat]);
  };

  const suggestCategories = async () => {
    setGenerating('categories');
    try {
      const result = await base44.integrations.Core.InvokeLLM({
        prompt: `Given a user with daily earning target $${data.daily_target || 1000}, risk tolerance "${data.risk_tolerance || 'moderate'}", and ${data.hours_per_day || 8} hours/day available, recommend the best 4-5 opportunity categories from this list: freelance, service, arbitrage, lead_gen, digital_flip, auction, resale, contest, giveaway, grant. Return ONLY a JSON object with a "categories" array of strings.`,
        response_json_schema: { type: 'object', properties: { categories: { type: 'array', items: { type: 'string' } } } },
      });
      if (result?.categories) set('preferred_categories', result.categories);
    } finally {
      setGenerating(null);
    }
  };

  const generateInstructions = async () => {
    setGenerating('instructions');
    try {
      const cats = (data.preferred_categories || []).join(', ') || 'freelance, service';
      const result = await base44.integrations.Core.InvokeLLM({
        prompt: `Write 3-4 concise, specific Autopilot AI instructions for a user targeting $${data.daily_target || 1000}/day, focusing on: ${cats}, with ${data.risk_tolerance || 'moderate'} risk. These tell the AI how to prioritize and execute tasks. Return ONLY the plain text instructions (no JSON, no bullet points header).`,
      });
      if (result) set('ai_instructions', result.trim());
    } finally {
      setGenerating(null);
    }
  };

  return (
    <div>
      <div className="flex items-center gap-2 mb-5">
        <Sliders className="w-5 h-5 text-cyan-400" />
        <h2 className="text-base font-bold text-white">Autopilot Preferences</h2>
      </div>

      <div className="space-y-4 max-h-[55vh] overflow-y-auto pr-1">

        {/* Earning targets */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-[10px] text-slate-500 uppercase tracking-wider block mb-1">Daily Earning Target ($)</label>
            <Input type="number" value={data.daily_target ?? 1000} onChange={e => set('daily_target', parseFloat(e.target.value) || 0)}
              className="bg-slate-800 border-slate-700 text-white text-xs h-8" />
          </div>
          <div>
            <label className="text-[10px] text-slate-500 uppercase tracking-wider block mb-1">Available Capital ($)</label>
            <Input type="number" value={data.available_capital ?? 0} onChange={e => set('available_capital', parseFloat(e.target.value) || 0)}
              className="bg-slate-800 border-slate-700 text-white text-xs h-8" />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-[10px] text-slate-500 uppercase tracking-wider block mb-1">Hours Available/Day</label>
            <Input type="number" value={data.hours_per_day ?? 8} onChange={e => set('hours_per_day', parseFloat(e.target.value) || 8)}
              className="bg-slate-800 border-slate-700 text-white text-xs h-8" />
          </div>
          <div>
            <label className="text-[10px] text-slate-500 uppercase tracking-wider block mb-1">Max Daily Spend ($)</label>
            <Input type="number" value={data.max_daily_spend ?? 500} onChange={e => set('max_daily_spend', parseFloat(e.target.value) || 500)}
              className="bg-slate-800 border-slate-700 text-white text-xs h-8" />
          </div>
        </div>

        {/* Risk tolerance */}
        <Toggle label="Risk Tolerance" value={data.risk_tolerance || 'moderate'}
          options={[
            { value: 'conservative', label: '🛡 Conservative' },
            { value: 'moderate', label: '⚖️ Moderate' },
            { value: 'aggressive', label: '🚀 Aggressive' },
          ]}
          onChange={v => set('risk_tolerance', v)} />

        {/* Preferred categories */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="text-[10px] text-slate-500 uppercase tracking-wider">Preferred Opportunity Categories</label>
            <button type="button" onClick={suggestCategories} disabled={!!generating}
              className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold border transition-all disabled:opacity-40"
              style={{ background: 'rgba(6,182,212,0.1)', border: '1px solid rgba(6,182,212,0.3)', color: '#67e8f9' }}>
              {generating === 'categories' ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
              Get Suggestions
            </button>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {CATEGORIES.map(c => (
              <button key={c} type="button" onClick={() => toggleCat(c)}
                className={`px-2.5 py-1 rounded-lg text-xs border capitalize transition-colors ${(data.preferred_categories || []).includes(c) ? 'bg-cyan-600/20 border-cyan-500/40 text-cyan-300' : 'bg-slate-800 border-slate-700 text-slate-500 hover:text-slate-300'}`}>
                {c.replace(/_/g, ' ')}
              </button>
            ))}
          </div>
        </div>

        {/* Autopilot default */}
        <Toggle label="Autopilot Default State" value={data.autopilot_enabled ? 'on' : 'off'}
          options={[{ value: 'on', label: '⚡ ON — Start immediately' }, { value: 'off', label: '⏸ OFF — I\'ll enable manually' }]}
          onChange={v => set('autopilot_enabled', v === 'on')} />

        {/* Region */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-[10px] text-slate-500 uppercase tracking-wider block mb-1">Timezone</label>
            <select value={data.timezone || 'America/Los_Angeles'} onChange={e => set('timezone', e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none">
              {TIMEZONES.map(tz => <option key={tz} value={tz}>{tz}</option>)}
            </select>
          </div>
          <div>
            <label className="text-[10px] text-slate-500 uppercase tracking-wider block mb-1">Region / Country</label>
            <Input value={data.region || ''} onChange={e => set('region', e.target.value)}
              placeholder="US" className="bg-slate-800 border-slate-700 text-white text-xs h-8" />
          </div>
        </div>

        {/* Notifications */}
        <div>
          <label className="text-[10px] text-slate-500 uppercase tracking-wider block mb-2">Notification Preferences</label>
          <div className="space-y-1.5">
            <CheckToggle label="Email alerts on task completion" checked={!!data.notify_email_completion} onChange={v => set('notify_email_completion', v)} />
            <CheckToggle label="Email alerts on errors" checked={!!data.notify_email_errors} onChange={v => set('notify_email_errors', v)} />
            <CheckToggle label="Daily earnings summary" checked={data.notify_daily_summary !== false} onChange={v => set('notify_daily_summary', v)} />
            <CheckToggle label="Weekly performance report" checked={data.notify_weekly_report !== false} onChange={v => set('notify_weekly_report', v)} />
          </div>
        </div>

        {/* Privacy / Permissions */}
        <div>
          <label className="text-[10px] text-slate-500 uppercase tracking-wider block mb-2">Permissions & Consent</label>
          <div className="space-y-1.5">
            <CheckToggle label="Allow Autopilot to create platform accounts on my behalf" checked={data.consent_account_creation !== false} onChange={v => set('consent_account_creation', v)} />
            <CheckToggle label="Allow AI to communicate with clients using my identity" checked={data.consent_client_communication !== false} onChange={v => set('consent_client_communication', v)} />
            <CheckToggle label="Allow analytics and performance learning" checked={data.consent_analytics !== false} onChange={v => set('consent_analytics', v)} />
          </div>
        </div>

        {/* AI instructions */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="text-[10px] text-slate-500 uppercase tracking-wider">Custom AI Instructions (optional)</label>
            <button type="button" onClick={generateInstructions} disabled={!!generating}
              className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold border transition-all disabled:opacity-40"
              style={{ background: 'rgba(139,92,246,0.12)', border: '1px solid rgba(139,92,246,0.35)', color: '#a78bfa' }}>
              {generating === 'instructions' ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
              Write with AI
            </button>
          </div>
          <textarea value={data.ai_instructions || ''} onChange={e => set('ai_instructions', e.target.value)} rows={2}
            placeholder="e.g. Prioritize writing gigs. Avoid anything related to crypto or gambling..."
            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-500/50 resize-none" />
        </div>

      </div>

      <div className="flex gap-2 mt-4 pt-3 border-t border-slate-800">
        <Button onClick={onBack} variant="outline" size="sm" className="border-slate-700 text-slate-400 h-9 px-4">
          <ArrowLeft className="w-3.5 h-3.5 mr-1" /> Back
        </Button>
        <Button onClick={onNext} size="sm" className="flex-1 bg-cyan-600 hover:bg-cyan-500 text-white h-9">
          Next: Banking Setup <ArrowRight className="w-3.5 h-3.5 ml-1" />
        </Button>
      </div>
    </div>
  );
}