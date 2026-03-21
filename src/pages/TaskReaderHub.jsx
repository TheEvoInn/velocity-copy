/**
 * Task Reader Hub
 * Central interface for Task Reading and Credential Management
 */
import React, { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Globe, Lock, Activity } from 'lucide-react';
import TaskReaderInterface from '@/components/task-reader/TaskReaderInterface';
import CredentialManager from '@/components/CredentialManager';

export default function TaskReaderHub() {
  const [activeTab, setActiveTab] = useState('reader');

  return (
    <div className="min-h-screen galaxy-bg p-4 md:p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-white mb-2">Task Reader Hub</h1>
          <p className="text-slate-400">
            Analyze external websites and manage encrypted credentials for auto-injection
          </p>
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
                  Submit external website URLs for intelligent analysis. The system will detect forms, 
                  extract fields, identify validation rules, and prepare for automatic execution with 
                  credential auto-injection.
                </p>
              </Card>
              <TaskReaderInterface />
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