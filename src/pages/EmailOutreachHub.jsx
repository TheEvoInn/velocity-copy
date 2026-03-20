import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Mail, Zap } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import EmailDraftGenerator from '../components/outreach/EmailDraftGenerator';
import EmailReviewQueue from '../components/outreach/EmailReviewQueue';
import AutopilotEmailScheduler from '../components/outreach/AutopilotEmailScheduler';

export default function EmailOutreachHub() {
  const [selectedOpp, setSelectedOpp] = useState(null);

  // Fetch approved opportunities for drafting
  const { data: opportunities = [] } = useQuery({
    queryKey: ['approvedOpportunities'],
    queryFn: async () => {
      const res = await base44.entities.Opportunity.filter({
        status: 'reviewing'
      });
      return res.filter(opp => opp.overall_score >= 60);
    },
    refetchInterval: 30000
  });

  return (
    <div className="min-h-screen bg-slate-950 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center">
              <Mail className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-white font-orbitron">Email Outreach Hub</h1>
              <p className="text-sm text-slate-400">AI-powered drafting with autopilot scheduling</p>
            </div>
          </div>
        </div>

        {/* Main Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left: Opportunity Selection & Draft */}
          <div className="lg:col-span-2 space-y-4">
            {/* Opportunity Selector */}
            <Card className="bg-slate-900/50 border-slate-700">
              <CardHeader>
                <CardTitle className="text-sm">Select Opportunity to Outreach</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {opportunities.length === 0 ? (
                    <div className="text-sm text-slate-500 py-4">
                      No approved opportunities available
                    </div>
                  ) : (
                    opportunities.map((opp) => (
                      <div
                        key={opp.id}
                        onClick={() => setSelectedOpp(opp)}
                        className={`p-3 rounded-lg border cursor-pointer transition-all ${
                          selectedOpp?.id === opp.id
                            ? 'bg-blue-900/30 border-blue-500/50'
                            : 'bg-slate-800/50 border-slate-700 hover:border-slate-600'
                        }`}
                      >
                        <div className="font-medium text-white text-sm">{opp.title}</div>
                        <div className="text-xs text-slate-500 mt-1 flex justify-between">
                          <span>{opp.platform}</span>
                          <span>Risk Score: {opp.overall_score}/100</span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Draft Generator */}
            {selectedOpp && (
              <EmailDraftGenerator
                opportunity={selectedOpp}
                onDraftGenerated={() => {
                  // Refresh queue after draft
                }}
              />
            )}
          </div>

          {/* Right: Autopilot Scheduler */}
          <div>
            <AutopilotEmailScheduler />
          </div>
        </div>

        {/* Full-width Review Queue */}
        <div>
          <EmailReviewQueue />
        </div>

        {/* Info & Best Practices */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card className="bg-blue-950/30 border-blue-500/30">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Mail className="w-4 h-4 text-blue-400" />
                Email Workflow
              </CardTitle>
            </CardHeader>
            <CardContent className="text-xs text-blue-200 space-y-2">
              <div>1. <span className="font-medium">Select Opportunity:</span> Choose from approved risks</div>
              <div>2. <span className="font-medium">Generate Draft:</span> AI creates personalized email</div>
              <div>3. <span className="font-medium">Queue for Review:</span> Set recipient & schedule time</div>
              <div>4. <span className="font-medium">Approve & Send:</span> Send immediately or via autopilot</div>
              <div>5. <span className="font-medium">Autopilot:</span> Auto-sends on your schedule</div>
            </CardContent>
          </Card>

          <Card className="bg-emerald-950/30 border-emerald-500/30">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Zap className="w-4 h-4 text-emerald-400" />
                Autopilot Benefits
              </CardTitle>
            </CardHeader>
            <CardContent className="text-xs text-emerald-200 space-y-2">
              <div>✓ Personalized emails via AI drafting</div>
              <div>✓ Human review before sending</div>
              <div>✓ Scheduled send times for optimal reach</div>
              <div>✓ Automatic retry on failures</div>
              <div>✓ Complete audit trail of all outreach</div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}