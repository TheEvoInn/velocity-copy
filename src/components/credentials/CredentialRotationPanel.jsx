/**
 * Credential Rotation Panel
 * Allows users to rotate credentials (password/API key) and configure auto-rotation schedules.
 */
import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { RefreshCw, Clock, Key, Lock, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

const ROTATION_INTERVALS = [
  { days: 30, label: '30 days' },
  { days: 60, label: '60 days' },
  { days: 90, label: '90 days' },
  { days: 180, label: '6 months' },
];

export default function CredentialRotationPanel({ credential, onClose }) {
  const qc = useQueryClient();
  const [newPassword, setNewPassword] = useState('');
  const [newApiKey, setNewApiKey] = useState('');
  const [newApiSecret, setNewApiSecret] = useState('');
  const [reason, setReason] = useState('');
  const [intervalDays, setIntervalDays] = useState(credential?.rotation_interval_days || 90);
  const [rotating, setRotating] = useState(false);
  const [scheduling, setScheduling] = useState(false);
  const [done, setDone] = useState(false);

  async function handleRotate() {
    if (!newPassword && !newApiKey && !newApiSecret) {
      toast.error('Enter at least one new credential value to rotate.');
      return;
    }
    setRotating(true);
    try {
      await base44.functions.invoke('credentialVaultManager', {
        action: 'rotate',
        credentialId: credential.id,
        payload: {
          new_password: newPassword || undefined,
          new_api_key: newApiKey || undefined,
          new_api_secret: newApiSecret || undefined,
          rotation_reason: reason || 'manual_rotation',
        },
      });
      toast.success('Credential rotated and encrypted successfully!');
      qc.invalidateQueries({ queryKey: ['platformCredentials'] });
      setDone(true);
    } catch (e) { toast.error(e.message); }
    setRotating(false);
  }

  async function handleSetSchedule() {
    setScheduling(true);
    try {
      await base44.functions.invoke('credentialVaultManager', {
        action: 'set_rotation_schedule',
        credentialId: credential.id,
        payload: { rotation_interval_days: intervalDays },
      });
      toast.success(`Auto-rotation scheduled every ${intervalDays} days.`);
      qc.invalidateQueries({ queryKey: ['platformCredentials'] });
    } catch (e) { toast.error(e.message); }
    setScheduling(false);
  }

  if (done) {
    return (
      <div className="text-center py-8 space-y-3">
        <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto" />
        <p className="text-sm font-semibold text-white">Rotation Complete</p>
        <p className="text-xs text-slate-500">New credentials encrypted and stored securely.</p>
        <Button onClick={onClose} size="sm" variant="outline" className="border-slate-700 text-slate-400 text-xs">Close</Button>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Platform context */}
      <div className="flex items-center gap-2 p-3 rounded-xl"
        style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
        <Lock className="w-4 h-4 text-amber-400" />
        <div>
          <p className="text-xs font-semibold text-white capitalize">{credential.platform} — {credential.account_label}</p>
          <p className="text-[10px] text-slate-500">{credential.username_email}</p>
        </div>
      </div>

      {/* New credentials section */}
      <div className="space-y-3">
        <div className="text-xs font-orbitron text-slate-500 tracking-widest flex items-center gap-2">
          <Key className="w-3.5 h-3.5" /> NEW CREDENTIAL VALUES
        </div>
        <p className="text-[11px] text-slate-600">Leave blank to keep existing value. Fill in only what changed.</p>

        {['password', 'api_key', 'api_secret'].map(field => {
          const val = field === 'password' ? newPassword : field === 'api_key' ? newApiKey : newApiSecret;
          const setter = field === 'password' ? setNewPassword : field === 'api_key' ? setNewApiKey : setNewApiSecret;
          return (
            <div key={field}>
              <label className="text-[10px] text-slate-500 uppercase tracking-wider block mb-1">
                {field.replace('_', ' ')}
              </label>
              <input
                type="password"
                value={val}
                onChange={e => setter(e.target.value)}
                placeholder={`New ${field.replace('_', ' ')}…`}
                className="w-full px-3 py-2.5 rounded-xl text-xs font-mono text-white outline-none"
                style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)' }}
              />
            </div>
          );
        })}

        <div>
          <label className="text-[10px] text-slate-500 uppercase tracking-wider block mb-1">Reason for Rotation</label>
          <input
            type="text"
            value={reason}
            onChange={e => setReason(e.target.value)}
            placeholder="e.g. Scheduled rotation, Security audit, Suspected breach…"
            className="w-full px-3 py-2.5 rounded-xl text-xs text-white outline-none"
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)' }}
          />
        </div>

        <Button
          onClick={handleRotate}
          disabled={rotating}
          className="w-full gap-2 text-xs font-orbitron tracking-wide"
          style={{ background: 'linear-gradient(135deg, rgba(249,214,92,0.2), rgba(249,214,92,0.08))', border: '1px solid rgba(249,214,92,0.4)', color: '#f9d65c' }}>
          <RefreshCw className={`w-3.5 h-3.5 ${rotating ? 'animate-spin' : ''}`} />
          {rotating ? 'ENCRYPTING & ROTATING…' : 'ROTATE CREDENTIALS NOW'}
        </Button>
      </div>

      {/* Auto-rotation schedule */}
      <div className="space-y-3 pt-3 border-t border-slate-800">
        <div className="text-xs font-orbitron text-slate-500 tracking-widest flex items-center gap-2">
          <Clock className="w-3.5 h-3.5" /> AUTO-ROTATION SCHEDULE
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {ROTATION_INTERVALS.map(opt => (
            <button
              key={opt.days}
              onClick={() => setIntervalDays(opt.days)}
              className="py-2 rounded-xl text-xs font-orbitron transition-all"
              style={{
                background: intervalDays === opt.days ? 'rgba(0,232,255,0.15)' : 'rgba(255,255,255,0.03)',
                border: `1px solid ${intervalDays === opt.days ? 'rgba(0,232,255,0.4)' : 'rgba(255,255,255,0.07)'}`,
                color: intervalDays === opt.days ? '#00e8ff' : '#64748b',
              }}>
              {opt.label}
            </button>
          ))}
        </div>
        <Button
          onClick={handleSetSchedule}
          disabled={scheduling}
          variant="outline"
          className="w-full border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/10 text-xs h-9 gap-2 font-orbitron tracking-wide">
          <Clock className="w-3.5 h-3.5" />
          {scheduling ? 'SAVING…' : `SET ${intervalDays}-DAY AUTO-ROTATION`}
        </Button>
      </div>
    </div>
  );
}