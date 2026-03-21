import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Play, Pause, RotateCcw, ExternalLink, Loader2 } from 'lucide-react';

export default function SessionReplayPlayer({ task, debugUrl, executionLog = [] }) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);

  if (!debugUrl && (!executionLog || executionLog.length === 0)) {
    return (
      <Card className="bg-slate-900 border-slate-800">
        <CardContent className="p-6 text-center">
          <Loader2 className="w-8 h-8 text-slate-600 mx-auto mb-3 animate-spin" />
          <p className="text-sm text-slate-500">Recording session data...</p>
        </CardContent>
      </Card>
    );
  }

  const totalSteps = executionLog.length;

  return (
    <div className="space-y-4">
      {/* Browserbase Native Replay */}
      {debugUrl && (
        <Card className="bg-slate-900 border-slate-800 overflow-hidden">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm">Live Session Recording</CardTitle>
              <a
                href={debugUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium transition-all"
              >
                <ExternalLink className="w-3 h-3" />
                Open Full Replay
              </a>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="bg-black/40 aspect-video flex items-center justify-center text-center">
              <div>
                <p className="text-sm text-slate-300 mb-3">Full browser session recording available</p>
                <p className="text-xs text-slate-500">Click "Open Full Replay" to watch the complete interaction in Browserbase debugger</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Execution Timeline Player */}
      {executionLog.length > 0 && (
        <Card className="bg-slate-900 border-slate-800">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Execution Timeline</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Step Navigator */}
            <div className="space-y-2">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-slate-500">
                  Step {currentStep + 1} of {totalSteps}
                </span>
                <div className="flex gap-1.5">
                  <Button
                    onClick={() => setCurrentStep(Math.max(0, currentStep - 1))}
                    disabled={currentStep === 0}
                    size="sm"
                    className="h-7 px-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs"
                  >
                    ← Prev
                  </Button>
                  <Button
                    onClick={() => setIsPlaying(!isPlaying)}
                    size="sm"
                    className="h-7 px-2 bg-blue-600 hover:bg-blue-500 text-white text-xs"
                  >
                    {isPlaying ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
                  </Button>
                  <Button
                    onClick={() => {
                      setCurrentStep(0);
                      setIsPlaying(false);
                    }}
                    size="sm"
                    className="h-7 px-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs"
                  >
                    <RotateCcw className="w-3 h-3" />
                  </Button>
                  <Button
                    onClick={() => setCurrentStep(Math.min(totalSteps - 1, currentStep + 1))}
                    disabled={currentStep === totalSteps - 1}
                    size="sm"
                    className="h-7 px-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs"
                  >
                    Next →
                  </Button>
                </div>
              </div>

              {/* Progress bar */}
              <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-blue-500 to-blue-400 transition-all duration-300"
                  style={{ width: `${((currentStep + 1) / totalSteps) * 100}%` }}
                />
              </div>
            </div>

            {/* Current Step Details */}
            {executionLog && executionLog[currentStep] && (
              <div className="bg-slate-800/50 rounded-lg p-3 space-y-2 border border-slate-700">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-xs font-semibold text-white">
                      {executionLog[currentStep].step || 'Unknown step'}
                    </p>
                    <p className="text-[10px] text-slate-400 mt-0.5">
                      {executionLog[currentStep].timestamp ? new Date(executionLog[currentStep].timestamp).toLocaleTimeString() : 'No timestamp'}
                    </p>
                  </div>
                  <span
                    className={`text-xs px-2 py-0.5 rounded shrink-0 ${
                      executionLog[currentStep]?.status === 'completed'
                        ? 'bg-emerald-500/20 text-emerald-400'
                        : executionLog[currentStep]?.status === 'error'
                        ? 'bg-red-500/20 text-red-400'
                        : 'bg-blue-500/20 text-blue-400'
                    }`}
                  >
                    {executionLog[currentStep]?.status || 'pending'}
                  </span>
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">
                   {executionLog[currentStep]?.details || executionLog[currentStep]?.detail || 'No details available'}
                 </p>
              </div>
            )}

            {/* Timeline scroll */}
            <div className="space-y-1.5 max-h-40 overflow-y-auto">
              {executionLog.map((log, idx) => (
                <button
                  key={idx}
                  onClick={() => setCurrentStep(idx)}
                  className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs transition-all border ${
                    idx === currentStep
                      ? 'bg-blue-600/30 border-blue-500/50 text-blue-300'
                      : 'bg-slate-800/30 border-slate-700/50 text-slate-400 hover:text-slate-300'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate">{log.step}</span>
                    <span className="text-[10px] text-slate-600 shrink-0">
                      {log.status === 'completed' ? '✓' : log.status === 'error' ? '✕' : '◦'}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}