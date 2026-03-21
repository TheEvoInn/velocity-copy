import React, { useState } from 'react';
import { Plus, Trash2, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';

const CONDITION_TYPES = {
  profit_threshold: { label: 'Profit > $', type: 'number', placeholder: '100' },
  time_remaining: { label: 'Time until deadline', type: 'select', options: ['< 1 hour', '< 1 day', '< 7 days'] },
  platform: { label: 'Platform', type: 'select', options: ['upwork', 'fiverr', 'ebay', 'freelancer', 'linkedin'] },
  category: { label: 'Category', type: 'select', options: ['freelance', 'arbitrage', 'lead_gen', 'contest', 'grant'] },
  success_rate: { label: 'Success rate >', type: 'number', placeholder: '60' },
  capital_required: { label: 'Capital required <', type: 'number', placeholder: '500' },
};

const ACTIONS = {
  queue_task: 'Queue task for execution',
  send_alert: 'Send alert notification',
  skip_opportunity: 'Skip this opportunity',
  request_approval: 'Request user approval',
  escalate_priority: 'Escalate task priority',
};

export default function WorkflowConditionBuilder({ conditions = [], onUpdate }) {
  const [expandedCondition, setExpandedCondition] = useState(null);

  const addCondition = () => {
    const newConditions = [...conditions, { id: Date.now(), type: 'profit_threshold', operator: '>', value: 100, action: 'queue_task' }];
    onUpdate(newConditions);
  };

  const updateCondition = (id, field, value) => {
    const updated = conditions.map(c => c.id === id ? { ...c, [field]: value } : c);
    onUpdate(updated);
  };

  const removeCondition = (id) => {
    onUpdate(conditions.filter(c => c.id !== id));
  };

  return (
    <div className="space-y-3">
      {conditions.length === 0 ? (
        <div className="p-6 text-center text-slate-500 border border-dashed border-slate-700 rounded-lg">
          <p className="text-sm mb-3">No conditions defined yet</p>
          <Button size="sm" onClick={addCondition} className="bg-blue-600 hover:bg-blue-500">
            <Plus className="w-3.5 h-3.5 mr-1" /> Add First Condition
          </Button>
        </div>
      ) : (
        conditions.map(condition => {
          const condConfig = CONDITION_TYPES[condition.type];
          return (
            <div key={condition.id} className="p-4 rounded-lg border border-slate-700 bg-slate-900/50">
              <div className="flex items-center justify-between mb-3">
                <div
                  className="flex-1 cursor-pointer flex items-center gap-2"
                  onClick={() => setExpandedCondition(expandedCondition === condition.id ? null : condition.id)}
                >
                  <ChevronDown className={`w-4 h-4 text-slate-500 transition-transform ${expandedCondition === condition.id ? 'rotate-180' : ''}`} />
                  <span className="text-sm font-medium text-white">IF</span>
                  <select
                    value={condition.type}
                    onChange={e => updateCondition(condition.id, 'type', e.target.value)}
                    className="bg-slate-800 border border-slate-700 text-slate-300 rounded px-2 py-1 text-xs"
                    onClick={e => e.stopPropagation()}
                  >
                    {Object.entries(CONDITION_TYPES).map(([key, val]) => (
                      <option key={key} value={key}>{val.label}</option>
                    ))}
                  </select>
                </div>
                <button
                  onClick={() => removeCondition(condition.id)}
                  className="p-1.5 hover:bg-red-500/20 rounded text-red-400 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>

              {expandedCondition === condition.id && (
                <div className="ml-6 space-y-3 pt-3 border-t border-slate-700">
                  {/* Operator + Value */}
                  <div className="flex gap-2">
                    <select
                      value={condition.operator || '>'}
                      onChange={e => updateCondition(condition.id, 'operator', e.target.value)}
                      className="bg-slate-800 border border-slate-700 text-slate-300 rounded px-2 py-1 text-xs w-16"
                    >
                      <option value=">">{'>'}</option>
                      <option value=">=">{'>='}</option>
                      <option value="<">{'<'}</option>
                      <option value="<=">{' <='}</option>
                      <option value="=">=</option>
                    </select>

                    {condConfig.type === 'number' && (
                      <input
                        type="number"
                        value={condition.value || ''}
                        onChange={e => updateCondition(condition.id, 'value', parseFloat(e.target.value) || 0)}
                        placeholder={condConfig.placeholder}
                        className="flex-1 bg-slate-800 border border-slate-700 text-white rounded px-2 py-1 text-xs"
                      />
                    )}

                    {condConfig.type === 'select' && (
                      <select
                        value={condition.value || ''}
                        onChange={e => updateCondition(condition.id, 'value', e.target.value)}
                        className="flex-1 bg-slate-800 border border-slate-700 text-slate-300 rounded px-2 py-1 text-xs"
                      >
                        <option value="">Select...</option>
                        {condConfig.options.map(opt => (
                          <option key={opt} value={opt}>{opt}</option>
                        ))}
                      </select>
                    )}
                  </div>

                  {/* Action */}
                  <div>
                    <label className="text-xs text-slate-400 mb-1 block">Then:</label>
                    <select
                      value={condition.action || 'queue_task'}
                      onChange={e => updateCondition(condition.id, 'action', e.target.value)}
                      className="w-full bg-slate-800 border border-slate-700 text-slate-300 rounded px-2 py-1 text-xs"
                    >
                      {Object.entries(ACTIONS).map(([key, label]) => (
                        <option key={key} value={key}>{label}</option>
                      ))}
                    </select>
                  </div>
                </div>
              )}
            </div>
          );
        })
      )}

      {conditions.length > 0 && (
        <Button
          size="sm"
          variant="outline"
          onClick={addCondition}
          className="w-full border-slate-700 text-slate-400 hover:text-white gap-1.5"
        >
          <Plus className="w-3.5 h-3.5" /> Add Another Condition
        </Button>
      )}
    </div>
  );
}