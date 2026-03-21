import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Mail, Zap, AlertCircle, CheckCircle, Loader2 } from 'lucide-react';

export default function SequenceBuilder({ onSequenceCreated }) {
  const [step, setStep] = useState('config'); // config, review, active
  const [loading, setLoading] = useState(false);
  const [config, setConfig] = useState({
    name: '',
    sequence_type: 'digital_product',
    offer_type: 'high_ticket',
    target_product_id: '',
    days_between: 2
  });

  const handleCreateSequence = async () => {
    if (!config.name || !config.target_product_id) {
      alert('Please fill in all required fields');
      return;
    }

    setLoading(true);
    try {
      const response = await base44.functions.invoke('emailSequenceOrchestrator', {
        action: 'create_sequence',
        data: config
      });

      if (response.data.success) {
        setStep('review');
        if (onSequenceCreated) onSequenceCreated(response.data.sequence);
      }
    } catch (error) {
      alert('Error creating sequence: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  if (step === 'config') {
    return (
      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="w-5 h-5 text-primary" />
            Create Email Sequence
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">Sequence Name</label>
            <Input
              placeholder="e.g., Digital Product Launch"
              value={config.name}
              onChange={(e) => setConfig({ ...config, name: e.target.value })}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2">Sequence Type</label>
              <select
                value={config.sequence_type}
                onChange={(e) => setConfig({ ...config, sequence_type: e.target.value })}
                className="w-full bg-input border border-border rounded px-3 py-2 text-sm"
              >
                <option value="digital_product">Digital Product</option>
                <option value="affiliate_offer">Affiliate Offer</option>
                <option value="webinar">Webinar</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Offer Type</label>
              <select
                value={config.offer_type}
                onChange={(e) => setConfig({ ...config, offer_type: e.target.value })}
                className="w-full bg-input border border-border rounded px-3 py-2 text-sm"
              >
                <option value="high_ticket">High-Ticket ($1000+)</option>
                <option value="mid_ticket">Mid-Ticket ($100-1000)</option>
                <option value="low_ticket">Low-Ticket ($1-100)</option>
                <option value="affiliate">Affiliate</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Product/Offer ID</label>
            <Input
              placeholder="Enter DigitalStorefront ID or product ID"
              value={config.target_product_id}
              onChange={(e) => setConfig({ ...config, target_product_id: e.target.value })}
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Days Between Emails</label>
            <Input
              type="number"
              min="1"
              max="7"
              value={config.days_between}
              onChange={(e) => setConfig({ ...config, days_between: parseInt(e.target.value) })}
            />
          </div>

          <Button
            onClick={handleCreateSequence}
            disabled={loading}
            className="w-full"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Generating Sequence...
              </>
            ) : (
              <>
                <Zap className="w-4 h-4 mr-2" />
                Generate 5-Email Sequence
              </>
            )}
          </Button>

          <div className="bg-accent/10 border border-accent rounded p-3 text-sm">
            <p className="font-medium mb-1">AI will generate:</p>
            <ul className="list-disc ml-4 space-y-1 text-muted-foreground">
              <li>5 personalized emails with proven conversion structure</li>
              <li>Copywriting optimized for your offer type</li>
              <li>Strategic timing and pacing</li>
              <li>Customizable templates</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="glass-card border-emerald-500/30">
      <CardHeader className="bg-emerald-500/5">
        <CardTitle className="flex items-center gap-2">
          <CheckCircle className="w-5 h-5 text-emerald-500" />
          Sequence Created
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-6">
        <p className="text-sm text-muted-foreground mb-4">
          Your 5-email sequence is ready. Review and activate to start enrolling leads.
        </p>
        <Button onClick={() => setStep('config')} variant="outline" className="w-full">
          Create Another Sequence
        </Button>
      </CardContent>
    </Card>
  );
}