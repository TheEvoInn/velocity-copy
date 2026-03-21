import React, { useState, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import {
  GripVertical, Pause, Play, XCircle, ChevronDown, ChevronUp,
  Zap, Clock, AlertCircle, DollarSign, TrendingUp, RefreshCw,
  ArrowUpCircle, ArrowDownCircle, CheckCircle, Layers, Ban
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

const STATUS_CONFIG = {
  queued:       { label: 'QUEUED',      bg: 'rgba(59,130,246,0.1)',  border: 'rgba(59,130,246,0.3)',  text: '#60a5fa', Icon: Clock },
  processing:   { label: 'PROCESSING',  bg: 'rgba(168,85,247,0.1)', border: 'rgba(168,85,247,0.3)', text: '#c084fc', Icon: Zap },
  needs_review: { label: 'REVIEW',      bg: 'rgba(245,158,11,0.1)', border: 'rgba(245,158,11,0.3)', text: '#fbbf24', Icon: AlertCircle },
  paused:       { label: 'PAUSED',      bg: 'rgba(100,116,139,0.1)', border: 'rgba(100,116,139,0.3)', text: '#94a3b8', Icon: Pause },
};

const FILTERS = ['all', 'queued', 'processing', 'needs_review', 'paused'];

function PriorityBar({ value }) {
  const pct = Math.min(100, Math.max(0, value || 50));
  const color = pct >= 75 ? '#ef4444' : pct >= 50 ? '#f59e0b' : '#3b82f6';
  return (
    <div className="flex items-center gap-1.5">
      <div className="w-16 h-1.5 rounded-full bg-slate-700/60 overflow-hidden">
        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: color }} />
      </div>
      <span className="text-[10px] font-mono" style={{ color }}>{pct}</span>
    </div>
  );
}

export default function TaskQueueManager() {
  const qc = useQueryClient();
  const [filter, setFilter] = useState('all');
  const [expanded, setExpanded] = useState(null);
  const [selected, setSelected] = useState(new Set());
  const [localOrder, setLocalOrder] = useState(null); // override after drag

  const { data: rawTasks = [], isLoading, refetch } = useQuery({
    queryKey: ['taskQueueManager'],
    queryFn: () => base44.entities.TaskExecutionQueue.filter(
      { status: { $in: ['queued', 'processing', 'needs_review', 'paused'] } },
      '-priority',
      200
    ),
    refetchInterval: 15000,
    onSuccess: () => { if (!localOrder) return; }, // keep local order until manual refresh
  });

  // Use localOrder if set (post-drag), otherwise server order
  const tasks = localOrder || rawTasks;

  const filtered = filter === 'all' ? tasks : tasks.filter(t => t.status === filter);

  // ── Mutations ─────────────────────────────────────────────────────────────
  const updateTask = useMutation({
    mutationFn: ({ id, data }) => base44.entities.TaskExecutionQueue.update(id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['taskQueueManager'] }); setLocalOrder(null); },
    onError: e => toast.error(e.message),
  });

  const bulkMutation = useMutation({
    mutationFn: async ({ ids, data }) => {
      await Promise.all(ids.map(id => base44.entities.TaskExecutionQueue.update(id, data)));
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['taskQueueManager'] });
      setSelected(new Set());
      setLocalOrder(null);
    },
    onError: e => toast.error(e.message),
  });

  // ── Drag & Drop ───────────────────────────────────────────────────────────
  const onDragEnd = useCallback(async (result) => {
    if (!result.destination) return;
    const src = result.source.index;
    const dst = result.destination.index;
    if (src === dst) return;

    // Reorder locally (all tasks, not just filtered)
    const reordered = Array.from(tasks);
    // Map filtered index back to full tasks index
    const filteredIds = filtered.map(t => t.id);
    const movedId = filteredIds[src];
    const targetId = filteredIds[dst];
    const srcFull = reordered.findIndex(t => t.id === movedId);
    const dstFull = reordered.findIndex(t => t.id === targetId);
    const [moved] = reordered.splice(srcFull, 1);
    reordered.splice(dstFull, 0, moved);
    setLocalOrder(reordered);

    // Assign new priorities (100 = highest)
    const maxP = reordered.length;
    await Promise.all(
      reordered.map((t, i) =>
        base44.entities.TaskExecutionQueue.update(t.id, { priority: maxP - i })
      )
    );
    toast.success('Queue order saved');
    qc.invalidateQueries({ queryKey: ['taskQueueManager'] });
  }, [tasks, filtered]);

  // ── Per-task actions ──────────────────────────────────────────────────────
  const pauseTask   = (t) => { updateTask.mutate({ id: t.id, data: { status: 'paused' } }); toast.success('Task paused'); };
  const resumeTask  = (t) => { updateTask.mutate({ id: t.id, data: { status: 'queued' } }); toast.success('Task resumed'); };
  const cancelTask  = (t) => { updateTask.mutate({ id: t.id, data: { status: 'cancelled' } }); toast.success('Task cancelled'); };
  const bumpUp      = (t) => { updateTask.mutate({ id: t.id, data: { priority: Math.min(100, (t.priority || 50) + 10) } }); };
  const bumpDown    = (t) => { updateTask.mutate({ id: t.id, data: { priority: Math.max(0,   (t.priority || 50) - 10) } }); };

  // ── Bulk actions ──────────────────────────────────────────────────────────
  const bulkPause  = () => bulkMutation.mutate({ ids: [...selected], data: { status: 'paused' } });
  const bulkResume = () => bulkMutation.mutate({ ids: [...selected], data: { status: 'queued' } });
  const bulkCancel = () => bulkMutation.mutate({ ids: [...selected], data: { status: 'cancelled' } });

  const toggleSelect = (id) => {
    setSelected(prev => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  };
  const selectAll   = () => setSelected(new Set(filtered.map(t => t.id)));
  const clearSelect = () => setSelected(new Set());

  const counts = FILTERS.reduce((acc, f) => {
    acc[f] = f === 'all' ? tasks.length : tasks.filter(t => t.status === f).length;
    return acc;
  }, {});

  return (
    <div className="space-y-5">

      {/* ── Header ── */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="font-orbitron text-lg font-bold text-white tracking-wide">TASK QUEUE MANAGER</h2>
          <p className="text-xs text-slate-500 mt-0.5">Drag to reorder · Pause, resume, or cancel before engine picks up</p>
        </div>
        <Button size="sm" variant="outline" onClick={() => { refetch(); setLocalOrder(null); }}
          className="border-slate-700 text-slate-400 hover:text-white text-xs h-8 gap-1.5">
          <RefreshCw className="w-3.5 h-3.5" /> Refresh
        </Button>
      </div>

      {/* ── Status Filter Tabs ── */}
      <div className="flex gap-1.5 overflow-x-auto pb-1">
        {FILTERS.map(f => {
          const cfg = STATUS_CONFIG[f];
          const active = filter === f;
          return (
            <button key={f} onClick={() => setFilter(f)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all"
              style={{
                background: active ? (cfg?.bg || 'rgba(6,182,212,0.15)') : 'rgba(255,255,255,0.03)',
                border: `1px solid ${active ? (cfg?.border || 'rgba(6,182,212,0.4)') : 'rgba(255,255,255,0.08)'}`,
                color: active ? (cfg?.text || '#22d3ee') : '#64748b',
              }}>
              {f === 'all' ? <Layers className="w-3 h-3" /> : React.createElement(cfg.Icon, { className: 'w-3 h-3' })}
              {f === 'all' ? 'All' : f.replace('_', ' ')}
              <span className="ml-1 px-1.5 py-0.5 rounded-full text-[10px]"
                style={{ background: 'rgba(255,255,255,0.07)', color: '#94a3b8' }}>
                {counts[f]}
              </span>
            </button>
          );
        })}
      </div>

      {/* ── Bulk Action Bar ── */}
      {selected.size > 0 && (
        <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl"
          style={{ background: 'rgba(6,182,212,0.08)', border: '1px solid rgba(6,182,212,0.25)' }}>
          <span className="text-xs text-cyan-300 font-medium mr-1">{selected.size} selected</span>
          <Button size="sm" variant="ghost" onClick={bulkPause}  disabled={bulkMutation.isPending}
            className="h-7 text-[11px] text-amber-400 hover:text-amber-300 gap-1 px-2">
            <Pause className="w-3 h-3" /> Pause All
          </Button>
          <Button size="sm" variant="ghost" onClick={bulkResume} disabled={bulkMutation.isPending}
            className="h-7 text-[11px] text-emerald-400 hover:text-emerald-300 gap-1 px-2">
            <Play className="w-3 h-3" /> Resume All
          </Button>
          <Button size="sm" variant="ghost" onClick={bulkCancel} disabled={bulkMutation.isPending}
            className="h-7 text-[11px] text-red-400 hover:text-red-300 gap-1 px-2">
            <Ban className="w-3 h-3" /> Cancel All
          </Button>
          <button onClick={clearSelect} className="ml-auto text-slate-500 hover:text-white text-[11px]">✕ Deselect</button>
          <button onClick={selectAll}  className="text-slate-500 hover:text-white text-[11px]">Select All</button>
        </div>
      )}

      {/* ── Select-all helper (when nothing selected) ── */}
      {selected.size === 0 && filtered.length > 0 && (
        <div className="flex items-center gap-2 text-[11px] text-slate-600">
          <button onClick={selectAll} className="hover:text-slate-400 transition-colors">Select all {filtered.length} tasks for bulk actions</button>
        </div>
      )}

      {/* ── Drag-and-drop list ── */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <RefreshCw className="w-5 h-5 animate-spin text-cyan-400" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-14">
          <CheckCircle className="w-10 h-10 mx-auto mb-3 text-emerald-500/30" />
          <p className="text-sm text-slate-500">No tasks in this view.</p>
        </div>
      ) : (
        <DragDropContext onDragEnd={onDragEnd}>
          <Droppable droppableId="task-queue">
            {(provided) => (
              <div ref={provided.innerRef} {...provided.droppableProps} className="space-y-2">
                {filtered.map((task, index) => {
                  const cfg   = STATUS_CONFIG[task.status] || STATUS_CONFIG.queued;
                  const isExp = expanded === task.id;
                  const isSel = selected.has(task.id);

                  return (
                    <Draggable key={task.id} draggableId={task.id} index={index}
                      isDragDisabled={task.status === 'processing'}>
                      {(prov, snap) => (
                        <div ref={prov.innerRef} {...prov.draggableProps}
                          className="rounded-xl overflow-hidden transition-all"
                          style={{
                            background: snap.isDragging
                              ? 'rgba(6,182,212,0.1)'
                              : isSel ? 'rgba(124,58,237,0.08)' : 'rgba(10,14,33,0.7)',
                            border: `1px solid ${snap.isDragging ? 'rgba(6,182,212,0.5)' : isSel ? 'rgba(124,58,237,0.35)' : 'rgba(255,255,255,0.07)'}`,
                            boxShadow: snap.isDragging ? '0 8px 32px rgba(6,182,212,0.2)' : 'none',
                            ...prov.draggableProps.style,
                          }}>

                          {/* ─ Row ─ */}
                          <div className="flex items-center gap-2 px-3 py-3">

                            {/* Checkbox */}
                            <input type="checkbox" checked={isSel}
                              onChange={() => toggleSelect(task.id)}
                              className="w-3.5 h-3.5 accent-violet-500 shrink-0 cursor-pointer"
                              onClick={e => e.stopPropagation()} />

                            {/* Drag handle */}
                            <div {...prov.dragHandleProps}
                              className={`p-1 rounded cursor-grab active:cursor-grabbing shrink-0 ${task.status === 'processing' ? 'opacity-20 cursor-not-allowed' : 'text-slate-600 hover:text-slate-400'}`}>
                              <GripVertical className="w-4 h-4" />
                            </div>

                            {/* Position badge */}
                            <span className="font-mono text-[10px] text-slate-600 w-5 text-center shrink-0">
                              {index + 1}
                            </span>

                            {/* Status pill */}
                            <div className="px-2 py-1 rounded-lg text-[10px] font-semibold shrink-0"
                              style={{ background: cfg.bg, border: `1px solid ${cfg.border}`, color: cfg.text }}>
                              {cfg.label}
                            </div>

                            {/* Main info */}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-medium text-white truncate">
                                  {task.opportunity_type?.toUpperCase()} · {task.platform || 'Unknown'}
                                </span>
                                {task.identity_name && (
                                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700 text-slate-400 shrink-0">
                                    {task.identity_name}
                                  </span>
                                )}
                              </div>
                              <p className="text-[11px] text-slate-500 truncate mt-0.5">
                                {task.url?.replace(/^https?:\/\//, '').substring(0, 70)}
                              </p>
                            </div>

                            {/* Priority bar */}
                            <div className="hidden sm:block shrink-0">
                              <PriorityBar value={task.priority} />
                            </div>

                            {/* Value */}
                            {task.estimated_value && (
                              <span className="text-[11px] font-semibold text-emerald-400 shrink-0">
                                ${task.estimated_value}
                              </span>
                            )}

                            {/* Quick actions */}
                            <div className="flex items-center gap-0.5 shrink-0">
                              <button onClick={() => bumpUp(task)}   title="Boost priority"
                                className="p-1 rounded hover:bg-blue-500/10 text-slate-500 hover:text-blue-400 transition-colors">
                                <ArrowUpCircle className="w-4 h-4" />
                              </button>
                              <button onClick={() => bumpDown(task)} title="Lower priority"
                                className="p-1 rounded hover:bg-slate-700 text-slate-500 hover:text-slate-300 transition-colors">
                                <ArrowDownCircle className="w-4 h-4" />
                              </button>
                              {task.status === 'processing' || task.status === 'queued' ? (
                                <button onClick={() => pauseTask(task)} title="Pause"
                                  className="p-1 rounded hover:bg-amber-500/10 text-slate-500 hover:text-amber-400 transition-colors">
                                  <Pause className="w-4 h-4" />
                                </button>
                              ) : (
                                <button onClick={() => resumeTask(task)} title="Resume"
                                  className="p-1 rounded hover:bg-emerald-500/10 text-slate-500 hover:text-emerald-400 transition-colors">
                                  <Play className="w-4 h-4" />
                                </button>
                              )}
                              <button onClick={() => cancelTask(task)} title="Cancel"
                                className="p-1 rounded hover:bg-red-500/10 text-slate-500 hover:text-red-400 transition-colors">
                                <XCircle className="w-4 h-4" />
                              </button>
                              <button onClick={() => setExpanded(isExp ? null : task.id)}
                                className="p-1 rounded hover:bg-slate-700 text-slate-500 hover:text-white transition-colors">
                                {isExp ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                              </button>
                            </div>
                          </div>

                          {/* ─ Expanded detail panel ─ */}
                          {isExp && (
                            <div className="border-t border-white/5 px-4 py-4 grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
                              <div>
                                <p className="text-slate-500 uppercase tracking-wide mb-1">Type</p>
                                <p className="text-white font-medium">{task.opportunity_type || '—'}</p>
                              </div>
                              <div>
                                <p className="text-slate-500 uppercase tracking-wide mb-1">Platform</p>
                                <p className="text-white font-medium capitalize">{task.platform || '—'}</p>
                              </div>
                              <div>
                                <p className="text-slate-500 uppercase tracking-wide mb-1">Priority</p>
                                <p className="text-white font-medium">{task.priority ?? '—'}</p>
                              </div>
                              <div>
                                <p className="text-slate-500 uppercase tracking-wide mb-1">Est. Value</p>
                                <p className="text-emerald-400 font-medium">{task.estimated_value ? `$${task.estimated_value}` : '—'}</p>
                              </div>
                              {task.deadline && (
                                <div>
                                  <p className="text-slate-500 uppercase tracking-wide mb-1">Deadline</p>
                                  <p className="text-white font-medium">{new Date(task.deadline).toLocaleString()}</p>
                                </div>
                              )}
                              {task.retry_count > 0 && (
                                <div>
                                  <p className="text-slate-500 uppercase tracking-wide mb-1">Retries</p>
                                  <p className="text-amber-400 font-medium">{task.retry_count}/{task.max_retries || 2}</p>
                                </div>
                              )}
                              <div className="col-span-2 md:col-span-4">
                                <p className="text-slate-500 uppercase tracking-wide mb-1">URL</p>
                                <a href={task.url} target="_blank" rel="noopener noreferrer"
                                  className="text-cyan-400 hover:text-cyan-300 break-all underline">
                                  {task.url}
                                </a>
                              </div>
                              {task.notes && (
                                <div className="col-span-2 md:col-span-4">
                                  <p className="text-slate-500 uppercase tracking-wide mb-1">Notes</p>
                                  <p className="text-slate-300">{task.notes}</p>
                                </div>
                              )}
                              {task.manual_review_reason && (
                                <div className="col-span-2 md:col-span-4">
                                  <p className="text-slate-500 uppercase tracking-wide mb-1">Review Reason</p>
                                  <p className="text-amber-300">{task.manual_review_reason}</p>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </Draggable>
                  );
                })}
                {provided.placeholder}
              </div>
            )}
          </Droppable>
        </DragDropContext>
      )}

      {/* ── Legend ── */}
      <div className="flex items-center gap-4 pt-2 text-[10px] text-slate-600 flex-wrap">
        <span className="flex items-center gap-1"><GripVertical className="w-3 h-3" /> Drag to reorder</span>
        <span className="flex items-center gap-1"><ArrowUpCircle className="w-3 h-3" /> Boost priority (+10)</span>
        <span className="flex items-center gap-1"><Pause className="w-3 h-3" /> Pause (hold before engine picks up)</span>
        <span className="flex items-center gap-1"><XCircle className="w-3 h-3" /> Cancel permanently</span>
      </div>
    </div>
  );
}