import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Loader2 } from 'lucide-react';
import LandingPageCustomizer from '@/components/customizer/LandingPageCustomizer';
import { toast } from 'sonner';

export default function PageCustomizer() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const storefrontId = searchParams.get('id');
  const queryClient = useQueryClient();

  const { data: storefront, isLoading } = useQuery({
    queryKey: ['storefront', storefrontId],
    queryFn: async () => {
      if (!storefrontId) return null;
      const res = await base44.entities.DigitalStorefront.read(storefrontId);
      return res;
    },
    enabled: !!storefrontId,
  });

  const updateMutation = useMutation({
    mutationFn: async (updates) => {
      const response = await base44.entities.DigitalStorefront.update(storefrontId, {
        ...updates,
        updated_at: new Date().toISOString()
      });
      return response;
    },
    onSuccess: () => {
      toast.success('Page saved successfully!');
      queryClient.invalidateQueries({ queryKey: ['storefront', storefrontId] });
      queryClient.invalidateQueries({ queryKey: ['userStorefronts'] });
    },
    onError: (err) => {
      toast.error(`Save failed: ${err.message}`);
    },
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 text-primary animate-spin" />
          <p className="text-muted-foreground">Loading page editor...</p>
        </div>
      </div>
    );
  }

  if (!storefront) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <p className="text-muted-foreground mb-4">Page not found</p>
          <Button onClick={() => navigate('/DigitalResellers')}>
            Back to Resellers
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4 flex flex-col">
      {/* Header */}
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button
            onClick={() => navigate('/DigitalResellers')}
            variant="outline"
            size="icon"
            className="h-9 w-9"
          >
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-foreground font-orbitron">
              Page Customizer
            </h1>
            <p className="text-xs text-muted-foreground">
              {storefront.page_title}
            </p>
          </div>
        </div>
      </div>

      {/* Customizer */}
      <div className="flex-1 min-h-0">
        <LandingPageCustomizer
          storefront={storefront}
          onSave={(updates) => updateMutation.mutate(updates)}
          isSaving={updateMutation.isPending}
        />
      </div>
    </div>
  );
}