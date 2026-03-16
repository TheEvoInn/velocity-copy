import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQueryClient } from '@tanstack/react-query';
import { Bot, Zap, CheckCircle2, Loader2, Plus, ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '@/components/ui/button';

const PLATFORMS = ['upwork', 'fiverr', 'freelancer', 'toptal', 'guru', 'peopleperhour', '99designs', 'truelancer', 'other'];

export default function AutoAccountCreator({ activeIdentity, onCreated }) {
  const [expanded, setExpanded] = useState(false);
  const [platform, setPlatform] = useState('upwork');
  const [purpose, setPurpose] = useState('');
  const [creating, setCreating] = useState(false);
  const [result, setResult] = useState(null);
  const qc = useQueryClient();

  const handleCreate = async () => {
    if (!platform) return;
    setCreating(true);
    setResult(null);
    const res = await base44.functions.invoke('identityEngine', {
      action: 'create_account',
      platform,
      purpose: purpose || `Freelancing on ${platform}`,
      identity_id: activeIdentity?.id
    });
    setResult(res?.data);
    if (res?.data?.success || res?.data?.already_exists) {
      qc.invalidateQueries({ queryKey: ['linkedAccounts'] });
      onCreated?.();
    }
    setCreating(false);
  };

  return (
    <div className="rounded-2xl bg-slate-900/80 border border-slate-800 overflow-hidden">
      <button onClick={() => setExpanded(v => !v)}
        className="w-full px-5 py-4 flex items-center justify-between hover:bg-slate-800/20 transition-colors">
        <div className="flex items-center gap-2">
          <Bot className="w-4 h-4 text-violet-400" />
          <span className="text-sm font-semibold text-white">Autonomous Account Creation</span>
          <span className="text-[10px] text-slate-500 bg-slate-800 px-1.5 py-0.5 rounded">AI-powered</span>
        </div>
        {expanded ? <ChevronUp className="w-4 h-4 text-slate-500" /> : <ChevronDown className="w-4 h-4 text-slate-500" />}
      </button>

      {expanded && (
        <div className="border-t border-slate-800 p-5 space-y-4">
          <p className="text-xs text-slate-500">
            If no account exists for a platform, the AI will automatically generate credentials, create the account, store it in CredentialVault, and link it to the active identity.
          </p>

          {activeIdentity && (
            <div className="flex items-center gap-2 bg-emerald-950/20 border border-emerald-500/20 rounded-lg px-3 py-2">
              <span className="text-[10px] text-emerald-400">Using identity:</span>
              <span className="text-[10px] font-semibold text-white">{activeIdentity.name}</span>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] text-slate-500 uppercase tracking-wider block mb-1">Platform</label>
              <select value={platform} onChange={e => setPlatform(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none h-8">
                {PLATFORMS.map(p => <option key={p} value={p} className="capitalize">{p}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[10px] text-slate-500 uppercase tracking-wider block mb-1">Purpose</label>
              <input value={purpose} onChange={e => setPurpose(e.target.value)} placeholder="e.g. copywriting jobs"
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none h-8" />
            </div>
          </div>

          <Button onClick={handleCreate} disabled={creating || !activeIdentity}
            className="w-full bg-violet-600 hover:bg-violet-500 text-white text-xs h-8 gap-1.5">
            {creating
              ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Creating Account...</>
              : <><Zap className="w-3.5 h-3.5" /> Auto-Create {platform} Account</>
            }
          </Button>

          {result && (
            <div className={`rounded-xl border p-4 space-y-2 ${
              result.already_exists ? 'bg-blue-950/20 border-blue-500/20' :
              result.success ? 'bg-emerald-950/20 border-emerald-500/20' :
              'bg-rose-950/20 border-rose-500/20'
            }`}>
              {result.already_exists ? (
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-blue-400" />
                  <span className="text-xs text-blue-400">{result.message}</span>
                </div>
              ) : result.success ? (
                <>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    <span className="text-xs font-semibold text-emerald-400">Account Created Successfully</span>
                  </div>
                  <div className="text-[10px] text-slate-400 space-y-0.5">
                    <div>Username: <span className="text-white font-mono">{result.generated_profile?.username}</span></div>
                    <div>Headline: <span className="text-slate-300">{result.generated_profile?.headline}</span></div>
                    <div className="text-emerald-400/70">Credentials encrypted and stored in CredentialVault ✓</div>
                  </div>
                  {result.generated_profile?.setup_steps?.length > 0 && (
                    <div>
                      <div className="text-[9px] text-slate-600 uppercase tracking-wider mb-1">Setup Steps</div>
                      {result.generated_profile.setup_steps.map((step, i) => (
                        <div key={i} className="text-[10px] text-slate-500 flex items-start gap-1.5">
                          <span className="text-emerald-500 mt-0.5">·</span> {step}
                        </div>
                      ))}
                    </div>
                  )}
                </>
              ) : (
                <div className="text-xs text-rose-400">{result.error || 'Creation failed'}</div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}