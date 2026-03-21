/**
 * Task Reader Hub
 * Central interface for Task Reading and Credential Management
 * Automated Workflow Engine for AI Analysis and Follow-up Execution
 */
import React, { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Globe, Lock, Activity, Zap, AlertCircle, CheckCircle2, Clock } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import TaskReaderInterface from '@/components/task-reader/TaskReaderInterface';
import CredentialManager from '@/components/CredentialManager';
import CaptchaMonitor from '@/components/CaptchaMonitor';
import AnalysisWorkflowMonitor from '@/components/task-reader/AnalysisWorkflowMonitor';

export default function TaskReaderHub() {
  const [activeTab, setActiveTab] = useState('reader');
  const [lastTaskAnalysis, setLastTaskAnalysis] = useState(null);
  const [recentAnalysisTasks, setRecentAnalysisTasks] = useState([]);
  const [workflowStats, setWorkflowStats] = useState({
    total: 0,
    completed: 0,
    processing: 0,
    failed: 0
  });
  const [isLoadingStats, setIsLoadingStats] = useState(false);

  // Load recent analysis tasks and workflow stats
  useEffect(() => {
    loadWorkflowStats();
    const interval = setInterval(loadWorkflowStats, 30000); // Refresh every 30 seconds
    return () => clearInterval(interval);
  }, []);

  const loadWorkflowStats = async () => {
    try {
      setIsLoadingStats(true);
      const tasks = await base44.entities.AITask.list('-created_at', 10);
      
      const stats = {
        total: tasks.length,
        completed: tasks.filter(t => t.status === 'completed').length,
        processing: tasks.filter(t => ['queued', 'analyzing', 'executing'].includes(t.status)).length,
        failed: tasks.filter(t => t.status === 'failed').length
      };
      
      setRecentAnalysisTasks(tasks);
      setWorkflowStats(stats);
    } catch (error) {
      console.error('Failed to load workflow stats:', error);
    } finally {
      setIsLoadingStats(false);
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'completed':
      case 'credentials_ready':
        return <CheckCircle2 className="w-4 h-4 text-emerald-500" />;
      case 'queued':
      case 'analyzing':
      case 'executing':
        return <Clock className="w-4 h-4 text-amber-500 animate-spin" />;
      case 'failed':
        return <AlertCircle className="w-4 h-4 text-red-500" />;
      default:
        return <Activity className="w-4 h-4 text-slate-400" />;
    }
  };

  return (
    <div className="min-h-screen galaxy-bg p-4 md:p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-white mb-2">Task Reader Hub</h1>
          <p className="text-slate-400">
            Automated AI analysis engine with intelligent workflow orchestration for web tasks
          </p>
        </div>

        {/* Workflow Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="p-4 bg-gradient-to-br from-violet-600/10 to-purple-600/10 border-violet-500/30">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-400 mb-1">Total Tasks</p>
                <p className="text-2xl font-bold text-white">{workflowStats.total}</p>
              </div>
              <Zap className="w-8 h-8 text-violet-500 opacity-50" />
            </div>
          </Card>
          
          <Card className="p-4 bg-gradient-to-br from-emerald-600/10 to-teal-600/10 border-emerald-500/30">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-400 mb-1">Completed</p>
                <p className="text-2xl font-bold text-emerald-400">{workflowStats.completed}</p>
              </div>
              <CheckCircle2 className="w-8 h-8 text-emerald-500 opacity-50" />
            </div>
          </Card>
          
          <Card className="p-4 bg-gradient-to-br from-amber-600/10 to-orange-600/10 border-amber-500/30">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-400 mb-1">Processing</p>
                <p className="text-2xl font-bold text-amber-400">{workflowStats.processing}</p>
              </div>
              <Clock className="w-8 h-8 text-amber-500 opacity-50 animate-spin" />
            </div>
          </Card>
          
          <Card className="p-4 bg-gradient-to-br from-red-600/10 to-pink-600/10 border-red-500/30">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-400 mb-1">Failed</p>
                <p className="text-2xl font-bold text-red-400">{workflowStats.failed}</p>
              </div>
              <AlertCircle className="w-8 h-8 text-red-500 opacity-50" />
            </div>
          </Card>
        </div>

        {/* Tab Navigation */}
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => setActiveTab('reader')}
            className={`px-4 py-2 rounded-lg font-medium transition flex items-center gap-2 ${
              activeTab === 'reader'
                ? 'bg-violet-600 text-white shadow-lg shadow-violet-600/20'
                : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            }`}
          >
            <Globe className="w-4 h-4" />
            Task Reader
          </button>
          <button
            onClick={() => setActiveTab('workflows')}
            className={`px-4 py-2 rounded-lg font-medium transition flex items-center gap-2 ${
              activeTab === 'workflows'
                ? 'bg-violet-600 text-white shadow-lg shadow-violet-600/20'
                : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            }`}
          >
            <Zap className="w-4 h-4" />
            Workflows
          </button>
          <button
            onClick={() => setActiveTab('credentials')}
            className={`px-4 py-2 rounded-lg font-medium transition flex items-center gap-2 ${
              activeTab === 'credentials'
                ? 'bg-violet-600 text-white shadow-lg shadow-violet-600/20'
                : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            }`}
          >
            <Lock className="w-4 h-4" />
            Credentials
          </button>
        </div>

        {/* Content */}
        <div>
          {activeTab === 'reader' && (
            <div className="space-y-6">
              <Card className="p-6 bg-gradient-to-r from-violet-600/10 to-purple-600/10 border-violet-500/30">
                <h2 className="text-xl font-semibold text-white mb-2">3rd-Party Task Reader</h2>
                <p className="text-slate-300">
                  Submit external website URLs for intelligent AI analysis. Automatic CAPTCHA detection and solving,
                  form field extraction, credential injection, and intelligent workflow generation.
                </p>
              </Card>
              
              {/* CAPTCHA Monitor */}
              {lastTaskAnalysis && (
                <CaptchaMonitor taskAnalysis={lastTaskAnalysis} />
              )}
              
              <TaskReaderInterface onAnalysisComplete={setLastTaskAnalysis} />
            </div>
          )}

          {activeTab === 'workflows' && (
            <div className="space-y-6">
              <Card className="p-6 bg-gradient-to-r from-blue-600/10 to-cyan-600/10 border-blue-500/30">
                <h2 className="text-xl font-semibold text-white mb-2">Automated Workflow Engine</h2>
                <p className="text-slate-300">
                  Real-time analysis orchestration with intelligent follow-up workflows. Auto-triggers CAPTCHA solving,
                  form filling, credential injection, manual reviews, and error recovery based on AI analysis.
                </p>
              </Card>
              
              <AnalysisWorkflowMonitor 
                recentTasks={recentAnalysisTasks}
                stats={workflowStats}
                onRefresh={loadWorkflowStats}
              />
            </div>
          )}

          {activeTab === 'credentials' && (
            <div className="space-y-6">
              <Card className="p-6 bg-gradient-to-r from-emerald-600/10 to-teal-600/10 border-emerald-500/30">
                <h2 className="text-xl font-semibold text-white mb-2">Credential Management</h2>
                <p className="text-slate-300">
                  Store credentials securely with AES-256-GCM encryption. Configure auto-injection rules 
                  for specific platforms and domains. Support for multi-factor authentication (TOTP, SMS, Email).
                </p>
              </Card>
              <CredentialManager />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}