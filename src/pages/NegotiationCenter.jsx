import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { MessageSquare, Clock, DollarSign, TrendingUp, CheckCircle2, X } from 'lucide-react';
import { format } from 'date-fns';
import NegotiationAssistant from '../components/negotiation/NegotiationAssistant';
import { Button } from '@/components/ui/button';

function ThreadCard({ thread, onSelect, selected }) {
  return (
    <button onClick={() => onSelect(thread)}
      className={`w-full rounded-xl border p-3 text-left transition-colors ${
        selected ? 'bg-slate-800 border-slate-600' : 'bg-slate-900/60 border-slate-800 hover:border-slate-700'
      }`}>
      <div className="flex items-start justify-between gap-2 mb-1.5">
        <div className="text-xs font-semibold text-white truncate flex-1">{thread.client || 'Unknown Client'}</div>
        {thread.revenue > 0 && (
          <span className="text-[10px] text-emerald-400 shrink-0">${thread.revenue.toFixed(0)}</span>
        )}
      </div>
      <div className="text-[11px] text-slate-500 truncate mb-1.5">{thread.last_message || 'No messages'}</div>
      <div className="flex items-center gap-2 text-[10px] text-slate-600">
        <span className="capitalize">{thread.platform || 'unknown'}</span>
        <span>·</span>
        <span>{thread.message_count} msg{thread.message_count !== 1 ? 's' : ''}</span>
        {thread.last_activity && (
          <><span>·</span><span>{format(new Date(thread.last_activity), 'MMM d')}</span></>
        )}
      </div>
    </button>
  );
}

export default function NegotiationCenter() {
  const [selectedThread, setSelectedThread] = useState(null);
  const [showNewThread, setShowNewThread] = useState(false);

  const { data: threadsData } = useQuery({
    queryKey: ['negotiation_threads'],
    queryFn: () => base44.functions.invoke('negotiationEngine', { action: 'get_active_threads' }),
    staleTime: 30000
  });

  const { data: insightsData } = useQuery({
    queryKey: ['negotiation_insights'],
    queryFn: () => base44.functions.invoke('negotiationEngine', { action: 'get_insights' }),
    staleTime: 60000
  });

  const threads = threadsData?.data?.threads || [];
  const insights = insightsData?.data || {};

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-blue-400" />
            Negotiation Center
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">Real-time client communication intelligence & response engine</p>
        </div>
        <Button onClick={() => setShowNewThread(true)} size="sm"
          className="bg-blue-600 hover:bg-blue-500 text-white text-xs h-8 gap-1.5">
          <MessageSquare className="w-3.5 h-3.5" /> Analyze Message
        </Button>
      </div>

      {/* Insights strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Total Proposals', value: insights.total_proposals || 0, color: 'text-white', icon: MessageSquare },
          { label: 'Conversion Rate', value: `${insights.conversion_rate || 0}%`, color: 'text-violet-400', icon: TrendingUp },
          { label: 'Jobs Completed', value: insights.jobs_completed || 0, color: 'text-blue-400', icon: CheckCircle2 },
          { label: 'Total Revenue', value: `$${(insights.total_revenue || 0).toFixed(0)}`, color: 'text-emerald-400', icon: DollarSign },
        ].map((m, i) => (
          <div key={i} className="rounded-2xl bg-slate-900/60 border border-slate-800 p-4">
            <div className="flex items-center gap-1.5 mb-1.5">
              <m.icon className={`w-3.5 h-3.5 ${m.color}`} />
              <span className="text-[10px] text-slate-500 uppercase tracking-wider">{m.label}</span>
            </div>
            <div className={`text-xl font-bold ${m.color}`}>{m.value}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Thread list */}
        <div className="lg:col-span-1 space-y-2">
          <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider px-1">Active Threads ({threads.length})</h3>
          {threads.length === 0 ? (
            <div className="rounded-xl bg-slate-900/40 border border-slate-800 py-8 text-center">
              <MessageSquare className="w-6 h-6 text-slate-700 mx-auto mb-1.5" />
              <p className="text-xs text-slate-600">No threads yet.</p>
              <p className="text-[10px] text-slate-700 mt-0.5">Messages will appear as you communicate with clients.</p>
            </div>
          ) : (
            <div className="space-y-1.5 max-h-[60vh] overflow-y-auto">
              {threads.map(t => (
                <ThreadCard key={t.id} thread={t} onSelect={setSelectedThread} selected={selectedThread?.id === t.id} />
              ))}
            </div>
          )}
        </div>

        {/* Main assistant panel */}
        <div className="lg:col-span-2">
          {showNewThread || selectedThread ? (
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-white">
                  {selectedThread ? `Thread: ${selectedThread.client}` : 'New Message Analysis'}
                </h3>
                <button onClick={() => { setShowNewThread(false); setSelectedThread(null); }}
                  className="text-slate-500 hover:text-white p-1">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <NegotiationAssistant thread={selectedThread} onClose={() => { setShowNewThread(false); setSelectedThread(null); }} />
            </div>
          ) : (
            <div className="rounded-2xl bg-slate-900/40 border border-slate-800 py-16 text-center">
              <MessageSquare className="w-10 h-10 text-slate-700 mx-auto mb-3" />
              <p className="text-sm text-slate-500">Select a thread or analyze a new message</p>
              <p className="text-xs text-slate-600 mt-1">The AI will suggest optimal responses based on your identity and past negotiations.</p>
              <Button onClick={() => setShowNewThread(true)} size="sm"
                className="mt-4 bg-blue-600 hover:bg-blue-500 text-white text-xs gap-1.5">
                <MessageSquare className="w-3.5 h-3.5" /> Analyze Message
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}