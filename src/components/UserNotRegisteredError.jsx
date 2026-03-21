import React from 'react';
import { Zap } from 'lucide-react';

const UserNotRegisteredError = () => {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen"
      style={{ background: 'var(--galaxy-deep)' }}>
      <div className="max-w-md w-full p-8 rounded-2xl border border-violet-500/20"
        style={{ background: 'rgba(15,21,53,0.85)', boxShadow: '0 0 60px rgba(124,58,237,0.2)' }}>
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 mb-6 rounded-2xl"
            style={{ background: 'linear-gradient(135deg, rgba(124,58,237,0.3), rgba(6,182,212,0.2))', border: '1px solid rgba(124,58,237,0.4)' }}>
            <Zap className="w-8 h-8 text-violet-400" />
          </div>
          <p className="font-orbitron text-xs tracking-[0.3em] text-violet-400/70 mb-2">VELOCITY · PROFIT ENGINE</p>
          <h1 className="text-2xl font-bold text-white mb-4 font-orbitron tracking-wide">Access Restricted</h1>
          <p className="text-slate-400 mb-8 text-sm leading-relaxed">
            You are not registered on the VELOCITY platform. Please contact the administrator to request access.
          </p>
          <div className="p-4 rounded-xl border border-slate-700/50 text-sm text-slate-500 text-left"
            style={{ background: 'rgba(255,255,255,0.03)' }}>
            <p className="text-slate-400 font-medium mb-2">To gain access:</p>
            <ul className="list-disc list-inside space-y-1">
              <li>Verify you are logged in with the correct account</li>
              <li>Contact your VELOCITY administrator</li>
              <li>Try logging out and back in again</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default UserNotRegisteredError;