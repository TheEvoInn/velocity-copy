import React from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Bookmark, BookmarkCheck, Zap, Star, Users, TrendingUp } from 'lucide-react';

const DIFFICULTY_STYLE = {
  beginner:     { label: 'Beginner',     color: '#10b981' },
  intermediate: { label: 'Intermediate', color: '#f59e0b' },
  advanced:     { label: 'Advanced',     color: '#ef4444' },
};

const CATEGORY_LABEL = {
  freelance: 'Freelance', arbitrage: 'Arbitrage', lead_gen: 'Lead Gen',
  contest: 'Contest', grant: 'Grant', resale: 'Resale', service: 'Service', general: 'General'
};

export default function TemplateCard({ template, isSaved, isApplied, onSave, onApply, applying }) {
  const diff = DIFFICULTY_STYLE[template.difficulty] || DIFFICULTY_STYLE.beginner;
  const color = template.color || '#7c3aed';
  const profitRange = template.estimated_daily_profit_low && template.estimated_daily_profit_high
    ? `$${template.estimated_daily_profit_low}–$${template.estimated_daily_profit_high}/day`
    : null;

  return (
    <div
      className="relative rounded-2xl p-5 flex flex-col gap-3 transition-all duration-200 hover:scale-[1.01]"
      style={{
        background: `linear-gradient(135deg, ${color}08, rgba(10,14,33,0.85))`,
        border: `1px solid ${color}30`,
        boxShadow: isApplied ? `0 0 20px ${color}30` : 'none',
      }}
    >
      {/* Official badge */}
      {template.is_official && (
        <div className="absolute top-3 right-3 flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold"
          style={{ background: `${color}20`, border: `1px solid ${color}40`, color }}>
          <Star className="w-2.5 h-2.5" fill="currentColor" /> Official
        </div>
      )}

      {/* Header */}
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl shrink-0"
          style={{ background: `${color}15`, border: `1px solid ${color}30` }}>
          {template.icon || '⚙️'}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-white leading-tight">{template.name}</h3>
          <p className="text-[11px] text-slate-400 mt-0.5 line-clamp-2">{template.description}</p>
        </div>
      </div>

      {/* Badges */}
      <div className="flex flex-wrap gap-1.5">
        <span className="text-[10px] px-2 py-0.5 rounded-full"
          style={{ background: `${diff.color}15`, border: `1px solid ${diff.color}30`, color: diff.color }}>
          {diff.label}
        </span>
        {template.platform && (
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 border border-slate-700 text-slate-400 capitalize">
            {template.platform}
          </span>
        )}
        <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 border border-slate-700 text-slate-400">
          {CATEGORY_LABEL[template.category] || template.category}
        </span>
      </div>

      {/* Stats row */}
      <div className="flex items-center gap-4 text-[11px] text-slate-500">
        {profitRange && (
          <span className="flex items-center gap-1 text-emerald-400 font-medium">
            <TrendingUp className="w-3 h-3" /> {profitRange}
          </span>
        )}
        {template.use_count > 0 && (
          <span className="flex items-center gap-1">
            <Users className="w-3 h-3" /> {template.use_count.toLocaleString()} deployed
          </span>
        )}
      </div>

      {/* Applied indicator */}
      {isApplied && (
        <div className="px-2.5 py-1.5 rounded-lg text-[10px] font-medium text-center"
          style={{ background: `${color}15`, border: `1px solid ${color}30`, color }}>
          ✓ Currently Active
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-2 mt-auto pt-1">
        <Button
          size="sm"
          variant="outline"
          onClick={onSave}
          className="flex-1 h-8 text-[11px] border-slate-700 text-slate-400 hover:text-white gap-1"
        >
          {isSaved
            ? <><BookmarkCheck className="w-3 h-3 text-violet-400" /> Saved</>
            : <><Bookmark className="w-3 h-3" /> Save</>}
        </Button>
        <Button
          size="sm"
          onClick={onApply}
          disabled={applying || isApplied}
          className="flex-1 h-8 text-[11px] gap-1 text-white"
          style={{ background: isApplied ? `${color}30` : `linear-gradient(135deg, ${color}, ${color}cc)` }}
        >
          <Zap className="w-3 h-3" />
          {applying ? 'Applying...' : isApplied ? 'Active' : 'Apply'}
        </Button>
      </div>
    </div>
  );
}