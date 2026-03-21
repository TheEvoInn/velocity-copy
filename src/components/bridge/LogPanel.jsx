import React from 'react';
import { motion } from 'framer-motion';

export default function LogPanel({ tasks = [], onClose = null }) {
  return (
    <motion.div
      className="glass-card-bright rounded-2xl p-8 max-w-2xl w-full"
      initial={{ scale: 0.8, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      exit={{ scale: 0.8, opacity: 0 }}
    >
      <div className="flex items-start justify-between mb-6">
        <h2 className="font-orbitron text-2xl text-amber-300">📋 LOG TERMINAL</h2>
        {onClose && (
          <button onClick={onClose} className="text-slate-400 hover:text-white text-xl">
            ✕
          </button>
        )}
      </div>

      <div className="mb-6 p-4 rounded-lg bg-amber-500/10 border border-amber-500/30">
        <p className="text-xs text-slate-400 uppercase tracking-widest mb-2">Active Tasks</p>
        <p className="font-orbitron text-3xl text-amber-300">{tasks.length}</p>
      </div>

      <div className="space-y-2 mb-6 max-h-64 overflow-y-auto">
        {tasks.length > 0 ? (
          tasks.slice(0, 10).map((task, idx) => (
            <div
              key={task.id || idx}
              className="p-3 rounded-lg bg-slate-800/40 border border-slate-700/30"
            >
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-300 truncate">
                  {task.opportunity_type || `Task ${idx + 1}`}
                </span>
                <span className="text-xs text-amber-400/70 ml-2 capitalize">
                  {task.status || 'queued'}
                </span>
              </div>
              {task.url && (
                <p className="text-xs text-slate-500 mt-1 truncate">{task.url}</p>
              )}
            </div>
          ))
        ) : (
          <div className="p-4 text-center text-slate-500 text-sm">
            No active tasks
          </div>
        )}
      </div>

      <div className="space-y-2 text-xs text-slate-400">
        <p>▪ Queue Status: OPERATIONAL</p>
        <p>▪ Processing: NORMAL</p>
        <p>▪ Error Rate: 0%</p>
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