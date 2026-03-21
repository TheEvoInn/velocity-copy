import React from 'react';
import { AlertTriangle, CheckCircle2 } from 'lucide-react';

export default function WorkflowValidator({ errors }) {
  if (!errors || errors.length === 0) {
    return (
      <div className="glass-card rounded-2xl p-4">
        <div className="flex items-center gap-2 text-emerald-400">
          <CheckCircle2 className="w-4 h-4" />
          <span className="text-xs font-semibold">All validations passed</span>
        </div>
      </div>
    );
  }

  return (
    <div className="glass-card rounded-2xl p-4 border border-red-500/30">
      <div className="flex items-start gap-2 mb-3">
        <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
        <div>
          <h4 className="text-xs font-semibold text-red-300 mb-2">Validation Errors</h4>
          <ul className="space-y-1">
            {errors.map((error, idx) => (
              <li key={idx} className="text-xs text-red-200">
                • {error}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}