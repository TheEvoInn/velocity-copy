import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, CheckCircle, AlertCircle, UserPlus } from 'lucide-react';

export default function LeadEnrollmentForm({ sequenceId, onEnrollmentSuccess }) {
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [formData, setFormData] = useState({
    lead_email: '',
    first_name: '',
    last_name: '',
    company: '',
    source: 'landing_page'
  });

  const handleEnroll = async (e) => {
    e.preventDefault();

    if (!formData.lead_email || !formData.first_name) {
      alert('Please enter email and first name');
      return;
    }

    setLoading(true);
    try {
      const response = await base44.functions.invoke('emailSequenceOrchestrator', {
        action: 'enroll_lead',
        data: {
          sequence_id: sequenceId,
          lead_email: formData.lead_email,
          first_name: formData.first_name,
          last_name: formData.last_name,
          company: formData.company,
          source: formData.source,
          personalization_data: {
            company: formData.company || 'your organization'
          }
        }
      });

      if (response.data.success) {
        setSuccess(true);
        setFormData({
          lead_email: '',
          first_name: '',
          last_name: '',
          company: '',
          source: 'landing_page'
        });
        setTimeout(() => setSuccess(false), 3000);
        if (onEnrollmentSuccess) onEnrollmentSuccess(response.data.lead);
      }
    } catch (error) {
      alert('Error enrolling lead: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="glass-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <UserPlus className="w-5 h-5 text-primary" />
          Enroll Lead in Sequence
        </CardTitle>
      </CardHeader>
      <CardContent>
        {success ? (
          <div className="bg-emerald-500/10 border border-emerald-500/30 rounded p-4 flex items-center gap-3">
            <CheckCircle className="w-5 h-5 text-emerald-500" />
            <p className="text-sm text-emerald-400">Lead enrolled successfully!</p>
          </div>
        ) : (
          <form onSubmit={handleEnroll} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <Input
                placeholder="First Name *"
                value={formData.first_name}
                onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                required
              />
              <Input
                placeholder="Last Name"
                value={formData.last_name}
                onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
              />
            </div>

            <Input
              type="email"
              placeholder="Email Address *"
              value={formData.lead_email}
              onChange={(e) => setFormData({ ...formData, lead_email: e.target.value })}
              required
            />

            <Input
              placeholder="Company"
              value={formData.company}
              onChange={(e) => setFormData({ ...formData, company: e.target.value })}
            />

            <div>
              <label className="block text-sm font-medium mb-2">Lead Source</label>
              <select
                value={formData.source}
                onChange={(e) => setFormData({ ...formData, source: e.target.value })}
                className="w-full bg-input border border-border rounded px-3 py-2 text-sm"
              >
                <option value="landing_page">Landing Page</option>
                <option value="webinar">Webinar</option>
                <option value="manual_import">Manual Import</option>
                <option value="form">Form Submission</option>
              </select>
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="w-full"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Enrolling...
                </>
              ) : (
                'Enroll Lead'
              )}
            </Button>
          </form>
        )}

        <div className="mt-4 p-3 bg-accent/10 rounded border border-accent/20 text-xs text-muted-foreground">
          <p className="font-medium mb-1">What happens next:</p>
          <ul className="list-disc ml-4 space-y-0.5">
            <li>Lead is immediately added to sequence</li>
            <li>First email scheduled based on sequence settings</li>
            <li>Subsequent emails sent automatically</li>
            <li>Engagement tracked in real-time</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}