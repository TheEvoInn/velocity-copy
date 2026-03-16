import React, { useState } from 'react';
import { Power, Trash2, Link2, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

export default function IdentityCard({
  identity,
  isActive,
  isHealthy,
  onSwitch,
  onDelete,
  onManageAccounts,
  isLoading
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <Card className={`border transition-all ${isActive ? 'border-emerald-500/50 bg-emerald-950/20' : 'border-slate-700 bg-slate-900/50'} p-4`}>
      <div className="space-y-3">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-white">{identity.name}</h3>
              {isActive && <span className="px-2 py-1 rounded text-xs font-medium bg-emerald-950 text-emerald-400 border border-emerald-900/30">Active</span>}
            </div>
            <p className="text-xs text-slate-400 mt-1">{identity.role_label}</p>
          </div>
          <button onClick={() => setExpanded(!expanded)} className="text-slate-400 hover:text-white">
            <ChevronDown className={`w-4 h-4 transition-transform ${expanded ? 'rotate-180' : ''}`} />
          </button>
        </div>

        {/* Quick Info */}
        <div className="text-xs text-slate-400 space-y-0.5">
          <p>📧 {identity.email}</p>
          {identity.skills && <p>🛠️ {identity.skills.slice(0, 3).join(', ')}</p>}
        </div>

        {/* Actions */}
        <div className="flex gap-2">
          <Button
            size="sm"
            variant={isActive ? 'outline' : 'default'}
            onClick={onSwitch}
            disabled={isLoading || isActive}
            className="flex-1 text-xs"
          >
            <Power className="w-3 h-3 mr-1" />
            {isActive ? 'Active' : 'Switch'}
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={onManageAccounts}
            disabled={isLoading}
            className="flex-1 text-xs"
          >
            <Link2 className="w-3 h-3 mr-1" />
            Accounts
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={onDelete}
            disabled={isLoading || isActive}
            className="text-red-400 hover:text-red-300 hover:bg-red-950/20"
          >
            <Trash2 className="w-3 h-3" />
          </Button>
        </div>

        {/* Expanded Details */}
        {expanded && (
          <div className="pt-3 border-t border-slate-800 space-y-2 text-xs">
            <div>
              <p className="text-slate-500 font-medium">Bio</p>
              <p className="text-slate-400 mt-1">{identity.bio || 'No bio set'}</p>
            </div>
            <div>
              <p className="text-slate-500 font-medium">Tagline</p>
              <p className="text-slate-400 mt-1">{identity.tagline || 'No tagline set'}</p>
            </div>
            {identity.tasks_executed > 0 && (
              <div className="bg-slate-950 rounded p-2">
                <p className="text-slate-400">📊 Tasks executed: <strong>{identity.tasks_executed}</strong> • Earned: <strong className="text-emerald-400">${(identity.total_earned || 0).toLocaleString()}</strong></p>
              </div>
            )}
          </div>
        )}
      </div>
    </Card>
  );
}