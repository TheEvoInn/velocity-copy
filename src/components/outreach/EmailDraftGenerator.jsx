import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Mail, Sparkles, Send, Loader } from 'lucide-react';
import { toast } from 'sonner';

export default function EmailDraftGenerator({ opportunity, onDraftGenerated, injectedDraft }) {
  const [recipientEmail, setRecipientEmail] = useState('');
  const [draftStyle, setDraftStyle] = useState('professional');
  const [scheduledTime, setScheduledTime] = useState('');
  const [generatedDraft, setGeneratedDraft] = useState(injectedDraft || null);
  const queryClient = useQueryClient();

  // When a template is injected from the builder, pre-populate the draft
  useEffect(() => {
    if (injectedDraft) setGeneratedDraft(injectedDraft);
  }, [injectedDraft]);

  // Generate draft mutation
  const generateDraftMutation = useMutation({
    mutationFn: async () => {
      const res = await base44.functions.invoke('emailOutreachEngine', {
        action: 'draft_email',
        opportunity_id: opportunity.id,
        draft_params: {
          style: draftStyle,
          recipient: recipientEmail
        }
      });
      return res.data;
    },
    onSuccess: (data) => {
      setGeneratedDraft(data.draft);
      toast.success('Email draft generated');
    },
    onError: (error) => {
      toast.error(`Draft generation failed: ${error.message}`);
    }
  });

  // Queue for review mutation
  const queueForReviewMutation = useMutation({
    mutationFn: async () => {
      const res = await base44.functions.invoke('emailOutreachEngine', {
        action: 'queue_for_review',
        opportunity_id: opportunity.id,
        recipient_email: recipientEmail,
        draft_params: {
          subject: generatedDraft.subject,
          body: generatedDraft.body,
          scheduled_send_time: scheduledTime || new Date(Date.now() + 3600000).toISOString()
        }
      });
      return res.data;
    },
    onSuccess: (data) => {
      toast.success('Email queued for review');
      onDraftGenerated?.();
      setGeneratedDraft(null);
      setRecipientEmail('');
    },
    onError: (error) => {
      toast.error(`Queue failed: ${error.message}`);
    }
  });

  const handleGenerateDraft = () => {
    if (!recipientEmail) {
      toast.error('Please enter recipient email');
      return;
    }
    generateDraftMutation.mutate();
  };

  const handleQueueForReview = () => {
    if (!scheduledTime && !recipientEmail) {
      toast.error('Please set a scheduled time or recipient');
      return;
    }
    queueForReviewMutation.mutate();
  };

  return (
    <div className="space-y-4">
      {/* Input Section */}
      {!generatedDraft ? (
        <Card className="bg-slate-900/50 border-slate-700">
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <Mail className="w-4 h-4 text-blue-400" />
              Draft Email
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <label className="text-xs font-medium text-slate-300">Recipient Email</label>
              <Input
                type="email"
                value={recipientEmail}
                onChange={(e) => setRecipientEmail(e.target.value)}
                placeholder="contact@example.com"
                className="bg-slate-800 border-slate-700 text-white mt-1"
              />
            </div>

            <div>
              <label className="text-xs font-medium text-slate-300">Email Style</label>
              <select
                value={draftStyle}
                onChange={(e) => setDraftStyle(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 text-white rounded-md px-3 py-2 text-xs mt-1"
              >
                <option value="professional">Professional & Formal</option>
                <option value="friendly">Friendly & Approachable</option>
                <option value="assertive">Assertive & Direct</option>
                <option value="casual">Casual & Conversational</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-medium text-slate-300">Scheduled Send Time (optional)</label>
              <Input
                type="datetime-local"
                value={scheduledTime}
                onChange={(e) => setScheduledTime(e.target.value)}
                className="bg-slate-800 border-slate-700 text-white mt-1"
              />
            </div>

            <Button
              onClick={handleGenerateDraft}
              disabled={generateDraftMutation.isPending}
              className="w-full bg-blue-600 hover:bg-blue-700"
            >
              {generateDraftMutation.isPending ? (
                <>
                  <Loader className="w-4 h-4 mr-2 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 mr-2" />
                  Generate AI Draft
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      ) : (
        /* Draft Review Section */
        <Card className="bg-slate-900/50 border-emerald-500/30">
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <Mail className="w-4 h-4 text-emerald-400" />
              Review & Approve
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="p-3 rounded-lg bg-slate-800/50 border border-slate-700">
              <div className="text-xs text-slate-400 mb-1">TO:</div>
              <div className="text-sm font-medium text-white">{recipientEmail}</div>
            </div>

            <div className="p-3 rounded-lg bg-slate-800/50 border border-slate-700">
              <div className="text-xs text-slate-400 mb-1">SUBJECT:</div>
              <Textarea
                value={generatedDraft.subject}
                onChange={(e) =>
                  setGeneratedDraft({ ...generatedDraft, subject: e.target.value })
                }
                className="bg-slate-700/50 border-slate-600 text-white h-12 resize-none"
              />
            </div>

            <div className="p-3 rounded-lg bg-slate-800/50 border border-slate-700">
              <div className="text-xs text-slate-400 mb-2">BODY:</div>
              <Textarea
                value={generatedDraft.body}
                onChange={(e) =>
                  setGeneratedDraft({ ...generatedDraft, body: e.target.value })
                }
                className="bg-slate-700/50 border-slate-600 text-white h-40 resize-none text-sm"
              />
            </div>

            <div className="flex gap-2">
              <Button
                onClick={() => setGeneratedDraft(null)}
                variant="outline"
                className="flex-1"
              >
                Edit Draft
              </Button>
              <Button
                onClick={handleQueueForReview}
                disabled={queueForReviewMutation.isPending}
                className="flex-1 bg-emerald-600 hover:bg-emerald-700"
              >
                {queueForReviewMutation.isPending ? (
                  <>
                    <Loader className="w-4 h-4 mr-2 animate-spin" />
                    Queueing...
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4 mr-2" />
                    Queue for Review
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}