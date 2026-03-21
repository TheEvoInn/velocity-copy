/**
 * Payload Mapper Component
 * Map webhook payload fields to task execution parameters
 */
import React, { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Plus, X } from 'lucide-react';

export default function PayloadMapper({ webhook, onUpdate }) {
  const [mappings, setMappings] = useState(webhook?.payload_mapping || []);
  const [newMapping, setNewMapping] = useState({
    source_field: '',
    target_parameter: '',
    transform: 'direct',
    required: false
  });

  const addMapping = () => {
    if (newMapping.source_field && newMapping.target_parameter) {
      setMappings([...mappings, newMapping]);
      setNewMapping({
        source_field: '',
        target_parameter: '',
        transform: 'direct',
        required: false
      });
    }
  };

  const removeMapping = (idx) => {
    setMappings(mappings.filter((_, i) => i !== idx));
  };

  const handleSave = async () => {
    if (onUpdate) {
      await onUpdate({ payload_mapping: mappings });
    }
  };

  return (
    <Card className="p-4 bg-slate-900/50 border-slate-800">
      <h4 className="font-semibold text-white mb-4">Payload Field Mapping</h4>

      {/* New Mapping Form */}
      <div className="bg-slate-800/50 rounded-lg p-3 mb-4 space-y-3">
        <input
          type="text"
          placeholder="Source field (e.g., 'data.url' or 'form.email')"
          value={newMapping.source_field}
          onChange={e => setNewMapping({...newMapping, source_field: e.target.value})}
          className="w-full bg-slate-700 border border-slate-600 rounded px-2 py-1 text-sm text-white placeholder-slate-400"
        />

        <input
          type="text"
          placeholder="Target parameter (e.g., 'url', 'email', 'name')"
          value={newMapping.target_parameter}
          onChange={e => setNewMapping({...newMapping, target_parameter: e.target.value})}
          className="w-full bg-slate-700 border border-slate-600 rounded px-2 py-1 text-sm text-white placeholder-slate-400"
        />

        <select
          value={newMapping.transform}
          onChange={e => setNewMapping({...newMapping, transform: e.target.value})}
          className="w-full bg-slate-700 border border-slate-600 rounded px-2 py-1 text-sm text-white"
        >
          <option value="direct">Direct (no transformation)</option>
          <option value="uppercase">Uppercase</option>
          <option value="lowercase">Lowercase</option>
          <option value="trim">Trim whitespace</option>
          <option value="url_encode">URL Encode</option>
          <option value="json_stringify">JSON Stringify</option>
        </select>

        <label className="flex items-center gap-2 text-sm text-white cursor-pointer">
          <input
            type="checkbox"
            checked={newMapping.required}
            onChange={e => setNewMapping({...newMapping, required: e.target.checked})}
            className="rounded"
          />
          Required field (fail if missing)
        </label>

        <Button onClick={addMapping} className="w-full gap-1 text-sm">
          <Plus className="w-3 h-3" />
          Add Mapping
        </Button>
      </div>

      {/* Current Mappings */}
      <div className="space-y-2">
        {mappings.map((mapping, idx) => (
          <div key={idx} className="flex items-center justify-between bg-slate-800 rounded-lg p-3 text-sm">
            <div className="flex-1 space-y-1">
              <div className="text-slate-300">
                <span className="text-slate-400">{mapping.source_field}</span>
                <span className="text-slate-500 mx-2">→</span>
                <span className="text-white">{mapping.target_parameter}</span>
              </div>
              <div className="text-xs text-slate-500">
                {mapping.transform !== 'direct' && `Transform: ${mapping.transform}`}
                {mapping.required && ' • Required'}
              </div>
            </div>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => removeMapping(idx)}
              className="h-6 w-6 p-0"
            >
              <X className="w-3 h-3" />
            </Button>
          </div>
        ))}
      </div>

      {mappings.length > 0 && (
        <Button
          onClick={handleSave}
          className="w-full mt-4"
        >
          Save Mappings
        </Button>
      )}
    </Card>
  );
}