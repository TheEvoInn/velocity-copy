import React, { useState } from 'react';
import { Plus, Trash2, Link2, Settings, ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '@/components/ui/button';

const AVAILABLE_TASKS = [
  { id: 'scan', label: 'Scan Platform', icon: '🔍', description: 'Find opportunities on a platform' },
  { id: 'filter', label: 'Filter & Score', icon: '⚡', description: 'Filter opportunities by criteria' },
  { id: 'apply', label: 'Auto Apply', icon: '📤', description: 'Submit applications automatically' },
  { id: 'email', label: 'Send Email', icon: '📧', description: 'Send personalized outreach' },
  { id: 'track', label: 'Track Results', icon: '📊', description: 'Monitor responses & earnings' },
];

export default function WorkflowBuilder({ onSave, initialWorkflow = null }) {
  const [tasks, setTasks] = useState(initialWorkflow?.tasks || []);
  const [expanded, setExpanded] = useState(null);

  const addTask = (taskType) => {
    const task = {
      id: `task_${Date.now()}`,
      type: taskType,
      config: {},
      conditions: [],
      customPrompt: '',
    };
    setTasks([...tasks, task]);
  };

  const removeTask = (taskId) => {
    setTasks(tasks.filter(t => t.id !== taskId));
  };

  const updateTask = (taskId, updates) => {
    setTasks(tasks.map(t => t.id === taskId ? { ...t, ...updates } : t));
  };

  const moveTask = (taskId, direction) => {
    const idx = tasks.findIndex(t => t.id === taskId);
    if ((direction === 'up' && idx === 0) || (direction === 'down' && idx === tasks.length - 1)) return;
    const newTasks = [...tasks];
    const moveIdx = direction === 'up' ? idx - 1 : idx + 1;
    [newTasks[idx], newTasks[moveIdx]] = [newTasks[moveIdx], newTasks[idx]];
    setTasks(newTasks);
  };

  return (
    <div className="space-y-4">
      {/* Task Chain */}
      <div className="space-y-2">
        {tasks.length === 0 ? (
          <div className="text-center py-8 text-slate-500">
            <p className="text-sm mb-3">No tasks added yet. Start building your workflow!</p>
          </div>
        ) : (
          tasks.map((task, idx) => {
            const taskDef = AVAILABLE_TASKS.find(t => t.id === task.type);
            return (
              <div key={task.id}>
                {/* Task Card */}
                <div className="rounded-lg border border-slate-700 bg-slate-800/40 p-3 hover:border-slate-600 transition-colors">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{taskDef?.icon}</span>
                      <div>
                        <p className="text-xs font-semibold text-white">{taskDef?.label}</p>
                        <p className="text-[10px] text-slate-500">{taskDef?.description}</p>
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <button
                        onClick={() => moveTask(task.id, 'up')}
                        disabled={idx === 0}
                        className="p-1 text-slate-500 disabled:opacity-30 hover:text-white transition-colors"
                      >
                        <ChevronUp className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => moveTask(task.id, 'down')}
                        disabled={idx === tasks.length - 1}
                        className="p-1 text-slate-500 disabled:opacity-30 hover:text-white transition-colors"
                      >
                        <ChevronDown className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => setExpanded(expanded === task.id ? null : task.id)}
                        className="p-1 text-slate-500 hover:text-white transition-colors"
                      >
                        <Settings className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => removeTask(task.id)}
                        className="p-1 text-red-500/60 hover:text-red-400 transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Expanded Config */}
                  {expanded === task.id && (
                    <div className="mt-3 pt-3 border-t border-slate-700 space-y-2">
                      {/* Task-specific settings */}
                      {task.type === 'scan' && (
                        <div className="space-y-2">
                          <label className="text-xs text-slate-400">Platform</label>
                          <select
                            value={task.config.platform || ''}
                            onChange={e => updateTask(task.id, { config: { ...task.config, platform: e.target.value } })}
                            className="w-full bg-slate-700 text-white rounded text-xs px-2 py-1"
                          >
                            <option value="">Select platform...</option>
                            <option value="upwork">Upwork</option>
                            <option value="fiverr">Fiverr</option>
                            <option value="freelancer">Freelancer</option>
                          </select>
                        </div>
                      )}

                      {task.type === 'filter' && (
                        <div className="space-y-2">
                          <label className="text-xs text-slate-400">Min Value ($)</label>
                          <input
                            type="number"
                            value={task.config.minValue || ''}
                            onChange={e => updateTask(task.id, { config: { ...task.config, minValue: e.target.value } })}
                            placeholder="e.g., 100"
                            className="w-full bg-slate-700 text-white rounded text-xs px-2 py-1"
                          />
                        </div>
                      )}

                      {(task.type === 'apply' || task.type === 'email') && (
                        <div className="space-y-2">
                          <label className="text-xs text-slate-400">Custom AI Prompt</label>
                          <textarea
                            value={task.customPrompt}
                            onChange={e => updateTask(task.id, { customPrompt: e.target.value })}
                            placeholder="e.g., Write a professional proposal emphasizing my experience..."
                            className="w-full bg-slate-700 text-white rounded text-xs px-2 py-1 h-16 resize-none"
                          />
                          <p className="text-[10px] text-slate-500">AI will use this to customize each action</p>
                        </div>
                      )}

                      {/* Conditions */}
                      <div className="space-y-2 pt-2 border-t border-slate-700">
                        <label className="text-xs text-slate-400">Stop if condition met:</label>
                        <select
                          defaultValue=""
                          onChange={e => {
                            if (e.target.value) {
                              updateTask(task.id, {
                                conditions: [...(task.conditions || []), e.target.value],
                              });
                              e.target.value = '';
                            }
                          }}
                          className="w-full bg-slate-700 text-white rounded text-xs px-2 py-1"
                        >
                          <option value="">Add condition...</option>
                          <option value="daily_earnings_met">Daily earnings target met</option>
                          <option value="max_applications">Max applications reached</option>
                          <option value="success_rate_low">Success rate drops below 50%</option>
                        </select>
                      </div>
                    </div>
                  )}
                </div>

                {/* Connector Arrow */}
                {idx < tasks.length - 1 && (
                  <div className="flex justify-center py-1">
                    <Link2 className="w-4 h-4 text-slate-600 rotate-90" />
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Add Task Menu */}
      <div className="rounded-lg border border-dashed border-slate-700 p-3">
        <p className="text-xs text-slate-500 mb-2">Add a task to your workflow:</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {AVAILABLE_TASKS.map(task => (
            <button
              key={task.id}
              onClick={() => addTask(task.id)}
              className="p-2 rounded text-xs hover:bg-slate-700 transition-colors border border-slate-700 hover:border-slate-600 text-center"
            >
              <span className="text-sm mr-1">{task.icon}</span>
              {task.label}
            </button>
          ))}
        </div>
      </div>

      {/* Save */}
      {tasks.length > 0 && (
        <Button
          onClick={() => onSave({ tasks })}
          className="w-full bg-violet-600 hover:bg-violet-500 text-white text-xs h-8"
        >
          Save Workflow
        </Button>
      )}
    </div>
  );
}