import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, XCircle, Mail, Clock, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

export default function EmailReviewQueue() {
  const [expandedId, setExpandedId] = useState(null);
  const queryClient = useQueryClient();

  // Fetch pending emails
  const { data: pendingData = {} } = useQuery({
    queryKey: ['pendingEmails'],
    queryFn: async () => {
      const res = await base44.functions.invoke('emailOutreachEngine', {
        action: 'get_pending_emails'
      });
      return res.data;
    },
    refetchInterval: 10000
  });

  // Approve and send mutation
  const approveMutation = useMutation({
    mutationFn: async (queueId) => {
      const res = await base44.functions.invoke('emailOutreachEngine', {
        action: 'approve_and_send',
        draft_params: {
          queue_id: queueId
        }
      });
      return res.data;
    },
    onSuccess: () => {
      toast.success('Email approved and sent');
      queryClient.invalidateQueries({ queryKey: ['pendingEmails'] });
    },
    onError: (error) => {
      toast.error(`Send failed: ${error.message}`);
    }
  });

  // Reject mutation
  const rejectMutation = useMutation({
    mutationFn: async ({ queueId, reason }) => {
      const res = await base44.functions.invoke('emailOutreachEngine', {
        action: 'reject_email',
        draft_params: {
          queue_id: queueId,
          reason: reason
        }
      });
      return res.data;
    },
    onSuccess: () => {
      toast.success('Email rejected');
      queryClient.invalidateQueries({ queryKey: ['pendingEmails'] });
    },
    onError: (error) => {
      toast.error(`Rejection failed: ${error.message}`);
    }
  });

  const emails = pendingData.emails || [];

  if (emails.length === 0) {
    return (
      <Card className="bg-slate-900/50 border-slate-700">
        <CardContent className="pt-6 text-center text-slate-500 text-sm">
          <Mail className="w-12 h-12 mx-auto opacity-20 mb-2" />
          No emails pending review
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-slate-900/50 border-slate-700">
      <CardHeader>
        <CardTitle className="text-sm flex items-center gap-2">
          <Mail className="w-4 h-4 text-amber-400" />
          Review Queue ({emails.length})
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2 max-h-96 overflow-y-auto">
          {emails.map((email) => (
            <div
              key={email.id}
              className="p-3 rounded-lg bg-slate-800/50 border border-slate-700 cursor-pointer hover:border-slate-600 transition-all"
            >
              <div
                onClick={() =>
                  setExpandedId(expandedId === email.id ? null : email.id)
                }
                className="flex items-start justify-between"
              >
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-white truncate">
                    {email.subject}
                  </div>
                  <div className="text-xs text-slate-500 mt-0.5">
                    To: {email.recipient_email}
                  </div>
                  <div className="flex items-center gap-2 mt-1.5">
                    <Badge
                      variant="outline"
                      className="text-xs bg-amber-500/10 text-amber-300 border-amber-500/30"
                    >
                      <Clock className="w-2.5 h-2.5 mr-1" />
                      {new Date(email.scheduled_send_time).toLocaleString()}
                    </Badge>
                  </div>
                </div>
                <Badge className="ml-2 bg-blue-500/20 text-blue-300">AI Draft</Badge>
              </div>

              {/* Expanded View */}
              {expandedId === email.id && (
                <div className="mt-3 pt-3 border-t border-slate-700 space-y-3">
                  <div className="p-2 rounded bg-slate-900/50 max-h-48 overflow-y-auto">
                    <div className="text-xs text-slate-400 mb-1">Preview:</div>
                    <div className="text-xs text-slate-300 whitespace-pre-wrap">
                      {email.body}
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <Button
                      onClick={() => approveMutation.mutate(email.id)}
                      disabled={approveMutation.isPending}
                      size="sm"
                      className="flex-1 bg-emerald-600 hover:bg-emerald-700 h-8"
                    >
                      {approveMutation.isPending ? (
                        <>
                          <Loader className="w-3 h-3 mr-1 animate-spin" />
                          Sending...
                        </>
                      ) : (
                        <>
                          <CheckCircle className="w-3 h-3 mr-1" />
                          Approve & Send
                        </>
                      )}
                    </Button>
                    <Button
                      onClick={() =>
                        rejectMutation.mutate({
                          queueId: email.id,
                          reason: 'Manual rejection'
                        })
                      }
                      disabled={rejectMutation.isPending}
                      size="sm"
                      variant="destructive"
                      className="flex-1 h-8"
                    >
                      {rejectMutation.isPending ? (
                        <>
                          <Loader className="w-3 h-3 mr-1 animate-spin" />
                          Rejecting...
                        </>
                      ) : (
                        <>
                          <XCircle className="w-3 h-3 mr-1" />
                          Reject
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}