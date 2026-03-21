/**
 * CAPTCHA Monitor Component
 * Real-time monitoring and management of CAPTCHA solving
 */
import React, { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { AlertCircle, Zap, CheckCircle2, Clock, Shield } from 'lucide-react';

export default function CaptchaMonitor({ taskAnalysis }) {
  const [captchaHistory, setCaptchaHistory] = useState([]);

  useEffect(() => {
    if (taskAnalysis?.metadata?.captcha_encountered) {
      setCaptchaHistory(prev => [...prev, {
        timestamp: new Date().toISOString(),
        types: taskAnalysis.metadata.captcha_types || [],
        solved: taskAnalysis.metadata.captcha_solved || false,
        task_id: taskAnalysis.id
      }]);
    }
  }, [taskAnalysis?.metadata?.captcha_encountered]);

  if (!captchaHistory.length) {
    return null;
  }

  const latestCaptcha = captchaHistory[captchaHistory.length - 1];
  const successRate = captchaHistory.filter(c => c.solved).length / captchaHistory.length;

  return (
    <div className="space-y-4">
      {/* CAPTCHA Status */}
      <Card className={`p-4 border ${
        latestCaptcha.solved 
          ? 'border-emerald-500/30 bg-emerald-500/5'
          : 'border-amber-500/30 bg-amber-500/5'
      }`}>
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-2">
            {latestCaptcha.solved ? (
              <>
                <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                <h3 className="font-semibold text-white">CAPTCHA Solved</h3>
              </>
            ) : (
              <>
                <AlertCircle className="w-5 h-5 text-amber-400" />
                <h3 className="font-semibold text-white">CAPTCHA Detected</h3>
              </>
            )}
          </div>
          <Badge className={latestCaptcha.solved ? 'bg-emerald-500/20 text-emerald-300' : 'bg-amber-500/20 text-amber-300'}>
            {latestCaptcha.types.join(', ')}
          </Badge>
        </div>

        <div className="grid grid-cols-3 gap-3 text-xs">
          <div>
            <p className="text-slate-400">Type</p>
            <p className="text-white capitalize">{latestCaptcha.types[0]?.replace('_', ' ')}</p>
          </div>
          <div>
            <p className="text-slate-400">Status</p>
            <p className={latestCaptcha.solved ? 'text-emerald-400' : 'text-amber-400'}>
              {latestCaptcha.solved ? 'Solved' : 'Detecting...'}
            </p>
          </div>
          <div>
            <p className="text-slate-400">Success Rate</p>
            <p className="text-white">{Math.round(successRate * 100)}%</p>
          </div>
        </div>
      </Card>

      {/* Statistics */}
      <Card className="p-4 bg-slate-900/50 border-slate-800">
        <h4 className="text-sm font-semibold text-white mb-3">CAPTCHA Statistics</h4>
        <div className="grid grid-cols-2 gap-3 text-xs">
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-violet-400" />
            <div>
              <p className="text-slate-400">Total Encountered</p>
              <p className="text-white text-lg font-semibold">{captchaHistory.length}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <div>
              <p className="text-slate-400">Successfully Solved</p>
              <p className="text-white text-lg font-semibold">{captchaHistory.filter(c => c.solved).length}</p>
            </div>
          </div>
        </div>
      </Card>

      {/* Recent History */}
      {captchaHistory.length > 1 && (
        <Card className="p-4 bg-slate-900/50 border-slate-800">
          <h4 className="text-sm font-semibold text-white mb-3">Recent Encounters</h4>
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {captchaHistory.slice(-5).reverse().map((item, idx) => (
              <div key={idx} className="flex items-center justify-between p-2 rounded bg-slate-800/50 text-xs">
                <div className="flex items-center gap-2">
                  {item.solved ? (
                    <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                  ) : (
                    <AlertCircle className="w-3 h-3 text-amber-400" />
                  )}
                  <span className="text-slate-300">{item.types.join(', ')}</span>
                </div>
                <span className="text-slate-500">
                  {new Date(item.timestamp).toLocaleTimeString()}
                </span>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Info */}
      <Card className="p-3 bg-violet-500/10 border-violet-500/30">
        <div className="flex gap-2 text-xs">
          <Shield className="w-4 h-4 text-violet-400 flex-shrink-0 mt-0.5" />
          <p className="text-violet-200">
            CAPTCHAs are automatically detected and solved using integrated services. 
            No manual intervention required for supported types.
          </p>
        </div>
      </Card>
    </div>
  );
}