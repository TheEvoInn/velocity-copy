import React from 'react';
import { motion } from 'framer-motion';

export default function TacticalPanel({ balance = 0, earned = 0, onClose = null }) {
  return (
    <motion.div
      className="glass-card-bright rounded-2xl p-8 max-w-2xl w-full"
      initial={{ scale: 0.8, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      exit={{ scale: 0.8, opacity: 0 }}
    >
      <div className="flex items-start justify-between mb-6">
        <h2 className="font-orbitron text-2xl text-cyan-300">⚙️ TACTICAL HOLO-TABLE</h2>
        {onClose && (
          <button onClick={onClose} className="text-slate-400 hover:text-white text-xl">
            ✕
          </button>
        )}
      </div>

      <div className="grid grid-cols-2 gap-6 mb-6">
        <div className="p-4 rounded-lg bg-cyan-500/10 border border-cyan-500/30">
          <p className="text-xs text-slate-400 uppercase tracking-widest mb-2">Available Capital</p>
          <p className="font-orbitron text-3xl text-cyan-300">${balance.toFixed(0)}</p>
        </div>
        <div className="p-4 rounded-lg bg-emerald-500/10 border border-emerald-500/30">
          <p className="text-xs text-slate-400 uppercase tracking-widest mb-2">Today Earned</p>
          <p className="font-orbitron text-3xl text-emerald-300">${earned.toFixed(0)}</p>
        </div>
      </div>

      <div className="space-y-3 text-sm text-slate-300">
        <p>▪ System Status: NOMINAL</p>
        <p>▪ Capital Allocation: OPTIMAL</p>
        <p>▪ Daily Target: ON TRACK</p>
        <p>▪ Risk Assessment: LOW</p>
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