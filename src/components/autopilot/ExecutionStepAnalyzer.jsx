import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { CheckCircle2, Clock, AlertCircle, Play, FileText, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

export default function ExecutionStepAnalyzer({ opportunityId, autoRefresh = true }) {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState(null);

  const { data: opportunity, isLoading: oppLoading } = useQuery({
    queryKey: ['opportunity', opportunityId],
    queryFn: () => base44.entities.Opportunity.list('-updated_date', 1),
    initialData: [],
    enabled: !!opportunityId,
    refetchInterval: autoRefresh ? 5000 : false,
  });

  const { data: executionQueue = [] } = useQuery({
    queryKey: ['executionQueue', opportunityId],
    queryFn: () => base44.entities.TaskExecutionQueue.filter({ opportunity_id: opportunityId }, '-created_date', 5),
    initialData: [],
    enabled: !!opportunityId,
    refetchInterval: autoRefresh ? 5000 : false,
  });

  const analyzeExecutionSteps = async () => {
    if (!opportunity[0]?.id) return;
    setIsAnalyzing(true);
    try {
      const result = await base44.functions.invoke('analyzeExecutionSteps', {
        opportunity_id: opportunity[0].id,
        execution_queue: executionQueue,
      });
      setAnalysisResult(result);
    } catch (error) {
      console.error('Analysis failed:', error);
    } finally {
      setIsAnalyzing(false);
    }
  };

  useEffect(() => {
    if (autoRefresh && opportunity.length > 0) {
      analyzeExecutionSteps();
    }
  }, [opportunity, executionQueue]);

  const opp = opportunity[0];
  if (!opp) return null;

  const completedSteps = opp.execution_steps?.filter(s => s.completed).length || 0;
  const totalSteps = opp.execution_steps?.length || 0;
  const progress = totalSteps > 0 ? Math.round((completedSteps / totalSteps) * 100) : 0;

  return (
    <Card className="bg-slate-900/80 border-slate-800">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-sm flex items-center gap-2">
              <Play className="w-4 h-4 text-emerald-400" />
              Execution Step Analysis
            </CardTitle>
            <CardDescription className="text-xs mt-1">
              {opp.title} — {completedSteps}/{totalSteps} steps completed
            </CardDescription>
          </div>
          <Button
            size="sm"
            onClick={analyzeExecutionSteps}
            disabled={isAnalyzing}
            className="bg-slate-700 hover:bg-slate-600 text-xs h-7"
          >
            <RefreshCw className={`w-3 h-3 mr-1 ${isAnalyzing ? 'animate-spin' : ''}`} />
            {isAnalyzing ? 'Analyzing...' : 'Analyze'}
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Progress Bar */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] text-slate-400">Overall Progress</span>
            <span className="text-[10px] font-semibold text-emerald-400">{progress}%</span>
          </div>
          <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-emerald-500 to-emerald-400 transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {/* Execution Steps */}
        <div className="space-y-2">
          {opp.execution_steps?.map((step, idx) => (
            <div key={idx} className="flex items-start gap-2.5 p-2.5 bg-slate-800/50 rounded-lg">
              <div className="mt-0.5">
                {step.completed ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                ) : step.completed === false && opp.status === 'executing' ? (
                  <Clock className="w-4 h-4 text-amber-400 animate-pulse" />
                ) : (
                  <Clock className="w-4 h-4 text-slate-500" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-[11px] font-medium text-white truncate">
                    {step.step}. {step.action}
                  </p>
                  {step.completed && (
                    <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20 text-[8px]">
                      Done
                    </Badge>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Analysis Results */}
        {analysisResult && (
          <div className="space-y-2 pt-2 border-t border-slate-700">
            <div className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5" />
              Analysis
            </div>
            <div className="bg-slate-800/50 rounded-lg p-3 space-y-2">
              {analysisResult.next_action && (
                <div>
                  <p className="text-[10px] text-slate-400">Next Action</p>
                  <p className="text-xs text-white">{analysisResult.next_action}</p>
                </div>
              )}
              {analysisResult.issues?.length > 0 && (
                <div>
                  <p className="text-[10px] text-slate-400 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" />
                    Issues
                  </p>
                  <ul className="text-[10px] text-red-400 space-y-1">
                    {analysisResult.issues.map((issue, i) => (
                      <li key={i}>• {issue}</li>
                    ))}
                  </ul>
                </div>
              )}
              {analysisResult.success_probability && (
                <div>
                  <p className="text-[10px] text-slate-400">Success Probability</p>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-1.5 bg-slate-700 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-blue-500"
                        style={{ width: `${analysisResult.success_probability}%` }}
                      />
                    </div>
                    <span className="text-[10px] font-semibold text-blue-400">
                      {analysisResult.success_probability}%
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Active Execution Queue */}
        {executionQueue.length > 0 && (
          <div className="space-y-2 pt-2 border-t border-slate-700">
            <p className="text-xs font-semibold text-slate-300">Active Executions ({executionQueue.length})</p>
            <div className="space-y-1.5">
              {executionQueue.slice(0, 3).map((task) => (
                <div key={task.id} className="flex items-center gap-2 p-2 bg-slate-800/50 rounded">
                  {task.status === 'completed' ? (
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  ) : task.status === 'processing' || task.status === 'filling' ? (
                    <div className="w-3.5 h-3.5 border-2 border-amber-400/30 border-t-amber-400 rounded-full animate-spin" />
                  ) : (
                    <Clock className="w-3.5 h-3.5 text-slate-500" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] text-white truncate">{task.platform}</p>
                    <p className="text-[9px] text-slate-400">{task.status}</p>
                  </div>
                  {task.estimated_value && (
                    <span className="text-[10px] font-semibold text-emerald-400">
                      ${task.estimated_value.toFixed(0)}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}