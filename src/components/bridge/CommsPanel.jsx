import React from 'react';
import { motion } from 'framer-motion';

export default function CommsPanel({ identities = [], onClose = null }) {
  return (
    <motion.div
      className="glass-card-bright rounded-2xl p-8 max-w-2xl w-full"
      initial={{ scale: 0.8, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      exit={{ scale: 0.8, opacity: 0 }}
    >
      <div className="flex items-start justify-between mb-6">
        <h2 className="font-orbitron text-2xl text-magenta-300">📡 COMMS ARRAY</h2>
        {onClose && (
          <button onClick={onClose} className="text-slate-400 hover:text-white text-xl">
            ✕
          </button>
        )}
      </div>

      <div className="mb-6 p-4 rounded-lg bg-magenta-500/10 border border-magenta-500/30">
        <p className="text-xs text-slate-400 uppercase tracking-widest mb-2">Active Channels</p>
        <p className="font-orbitron text-3xl text-magenta-300">{identities.length}</p>
      </div>

      <div className="space-y-2 mb-6 max-h-64 overflow-y-auto">
        {identities.length > 0 ? (
          identities.map((id, idx) => (
            <div
              key={id.id || idx}
              className="p-3 rounded-lg bg-slate-800/40 border border-slate-700/30 flex items-center justify-between"
            >
              <span className="text-sm text-slate-300">{id.name || `Identity ${idx + 1}`}</span>
              <span className="text-xs text-magenta-400/70">● ACTIVE</span>
            </div>
          ))
        ) : (
          <div className="p-4 text-center text-slate-500 text-sm">
            No active identities
          </div>
        )}
      </div>

      <div className="space-y-2 text-xs text-slate-400">
        <p>▪ Signal Strength: OPTIMAL</p>
        <p>▪ Encryption: ACTIVE</p>
        <p>▪ Latency: &lt;50ms</p>
      </div>

      {onClose && (
        <button
          onClick={onClose}
          className="mt-6 w-full px-4 py-2 btn-cosmic text-white rounded-lg"
        >
          Return to Bridge
        </button>
      )}
    </motion.div>
  );
}