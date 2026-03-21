/**
 * PAYLOAD MAPPER
 * Maps incoming JSON fields to canonical internal entity data models
 */
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

// Define canonical entity field schemas
const ENTITY_SCHEMAS = {
  Opportunity: {
    title: 'string',
    description: 'string',
    platform: 'string',
    category: 'select',
    profit_estimate_low: 'number',
    profit_estimate_high: 'number',
    url: 'string',
    deadline: 'datetime',
  },
  TaskExecutionQueue: {
    url: 'string',
    opportunity_type: 'select',
    platform: 'string',
    status: 'select',
    priority: 'number',
  },
  Transaction: {
    transaction_type: 'select',
    amount: 'number',
    value_usd: 'number',
    wallet_address: 'string',
    status: 'select',
  },
  CryptoWallet: {
    wallet_name: 'string',
    wallet_type: 'select',
    address: 'string',
    balance: 'object',
  },
  StakingPosition: {
    token_symbol: 'string',
    platform: 'string',
    amount_staked: 'number',
    apy_percentage: 'number',
  },
  ActivityLog: {
    action_type: 'select',
    message: 'string',
    severity: 'select',
    metadata: 'object',
  },
};

export default function PayloadMapper({ webhook, entityTypes, onClose, onSave }) {
  const [targetEntity, setTargetEntity] = useState('Opportunity');
  const [mappings, setMappings] = useState([]);
  const [samplePayload, setSamplePayload] = useState('{}');
  const [newMappingSource, setNewMappingSource] = useState('');
  const [newMappingTarget, setNewMappingTarget] = useState('');

  const schema = ENTITY_SCHEMAS[targetEntity] || {};
  const fields = Object.keys(schema);

  const addMapping = () => {
    if (!newMappingSource || !newMappingTarget) {
      toast.error('Fill in source and target fields');
      return;
    }
    if (mappings.some(m => m.source === newMappingSource || m.target === newMappingTarget)) {
      toast.error('Mapping already exists');
      return;
    }
    setMappings([...mappings, { source: newMappingSource, target: newMappingTarget, transform: '' }]);
    setNewMappingSource('');
    setNewMappingTarget('');
  };

  const removeMapping = (index) => {
    setMappings(mappings.filter((_, i) => i !== index));
  };

  const testMapping = () => {
    try {
      const payload = JSON.parse(samplePayload);
      const result = {};
      mappings.forEach(({ source, target, transform }) => {
        let value = payload[source];
        if (transform && value !== undefined) {
          try {
            value = eval(`(${transform})(${JSON.stringify(value)})`);
          } catch (e) {
            console.warn(`Transform failed for ${source}:`, e);
          }
        }
        result[target] = value;
      });
      toast.success('Mapping test passed');
      console.log('Mapped result:', result);
    } catch (e) {
      toast.error('Invalid payload JSON');
    }
  };

  return (
    <div className="space-y-4">
      {/* Target Entity */}
      <div>
        <label className="text-sm font-semibold text-white mb-2 block">Target Entity</label>
        <Select value={targetEntity} onValueChange={setTargetEntity}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {entityTypes.map(type => (
              <SelectItem key={type} value={type}>{type}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Mappings */}
      <div>
        <label className="text-sm font-semibold text-white mb-2 block">Field Mappings</label>
        <div className="space-y-2 mb-3">
          {mappings.map((mapping, idx) => (
            <div key={idx} className="flex gap-2 items-end">
              <div className="flex-1 bg-slate-800/40 p-2 rounded text-sm">
                <div className="text-xs text-slate-500">Source</div>
                <div className="text-white font-mono">{mapping.source}</div>
              </div>
              <div className="text-slate-500">→</div>
              <div className="flex-1 bg-slate-800/40 p-2 rounded text-sm">
                <div className="text-xs text-slate-500">Target</div>
                <div className="text-white font-mono">{mapping.target}</div>
              </div>
              <Button
                size="sm"
                variant="destructive"
                onClick={() => removeMapping(idx)}
              >
                <Trash2 className="w-3 h-3" />
              </Button>
            </div>
          ))}
        </div>

        {/* Add Mapping */}
        <div className="flex gap-2 mb-3">
          <Input
            placeholder="Source field (e.g., job_title)"
            value={newMappingSource}
            onChange={(e) => setNewMappingSource(e.target.value)}
            className="text-sm"
          />
          <Select value={newMappingTarget} onValueChange={setNewMappingTarget}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Target" />
            </SelectTrigger>
            <SelectContent>
              {fields.map(field => (
                <SelectItem key={field} value={field}>{field}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button onClick={addMapping} className="gap-1">
            <Plus className="w-3 h-3" />
            Add
          </Button>
        </div>
      </div>

      {/* Sample Payload */}
      <div>
        <label className="text-sm font-semibold text-white mb-2 block">Test Payload (JSON)</label>
        <Textarea
          value={samplePayload}
          onChange={(e) => setSamplePayload(e.target.value)}
          placeholder='{"job_title": "Software Engineer", "salary": 120000}'
          className="font-mono text-xs h-24"
        />
      </div>

      {/* Actions */}
      <div className="flex gap-2">
        <Button onClick={testMapping} variant="outline" className="flex-1">
          Test Mapping
        </Button>
        <Button onClick={onClose} variant="outline" className="flex-1">
          Cancel
        </Button>
        <Button
          onClick={() => onSave({ target_entity: targetEntity, field_mappings: mappings })}
          className="flex-1 btn-cosmic"
          disabled={mappings.length === 0}
        >
          Save Mapping
        </Button>
      </div>
    </div>
  );
}