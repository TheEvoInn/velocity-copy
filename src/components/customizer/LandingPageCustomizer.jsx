import React, { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Save, Eye, Palette, Layout as LayoutIcon, FileText } from 'lucide-react';
import LivePreview from './LivePreview';
import BrandingPanel from './BrandingPanel';
import LayoutPanel from './LayoutPanel';
import ContentPanel from './ContentPanel';

export default function LandingPageCustomizer({ storefront, onSave, isSaving }) {
  const [customStorefront, setCustomStorefront] = useState(storefront || {
    headline: '',
    subheading: '',
    description: '',
    call_to_action: 'Get Access Now',
    testimonial: '',
    features: [],
    faq: []
  });

  const [branding, setBranding] = useState({
    primaryColor: '#06b6d4',
    secondaryColor: '#7c3aed',
    accentColor: '#10b981',
    fontFamily: 'sans',
    headingSize: 'large',
    textSize: 'medium'
  });

  const [layout, setLayout] = useState({
    showFeatures: true,
    showTestimonial: true,
    showFAQ: true,
    featureColumns: 3,
    featureCount: 6,
    heroHeight: 'medium',
    ctaStyle: 'filled'
  });

  const [previewMode, setPreviewMode] = useState(false);

  const handleSave = async () => {
    await onSave({
      ...customStorefront,
      brand_colors: {
        primary: branding.primaryColor,
        secondary: branding.secondaryColor,
        accent: branding.accentColor
      },
      brand_fonts: {
        primary: branding.fontFamily,
        headingSize: branding.headingSize,
        textSize: branding.textSize
      }
    });
  };

  if (previewMode) {
    return (
      <div className="min-h-screen bg-gray-100 p-4 flex flex-col">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-white text-sm font-semibold">Full Page Preview</h2>
          <Button
            onClick={() => setPreviewMode(false)}
            variant="outline"
            size="sm"
            className="gap-2"
          >
            ← Back to Editor
          </Button>
        </div>
        <div className="flex-1 bg-white rounded-lg overflow-hidden shadow-xl">
          <LivePreview storefront={customStorefront} branding={branding} layout={layout} />
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 h-full">
      {/* Left Panel - Controls */}
      <div className="lg:col-span-1 overflow-y-auto space-y-4">
        <Tabs defaultValue="content" className="w-full">
          <TabsList className="grid w-full grid-cols-3 bg-slate-800/50">
            <TabsTrigger value="content" className="gap-1 text-xs">
              <FileText className="w-3 h-3" />
              <span className="hidden sm:inline">Content</span>
            </TabsTrigger>
            <TabsTrigger value="branding" className="gap-1 text-xs">
              <Palette className="w-3 h-3" />
              <span className="hidden sm:inline">Branding</span>
            </TabsTrigger>
            <TabsTrigger value="layout" className="gap-1 text-xs">
              <LayoutIcon className="w-3 h-3" />
              <span className="hidden sm:inline">Layout</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="content" className="space-y-4">
            <ContentPanel storefront={customStorefront} onChange={setCustomStorefront} />
          </TabsContent>

          <TabsContent value="branding" className="space-y-4">
            <BrandingPanel branding={branding} onChange={setBranding} />
          </TabsContent>

          <TabsContent value="layout" className="space-y-4">
            <LayoutPanel layout={layout} onChange={setLayout} />
          </TabsContent>
        </Tabs>

        {/* Action Buttons */}
        <div className="fixed bottom-0 left-0 right-0 lg:static p-4 lg:p-0 bg-gradient-to-t from-slate-950 to-transparent lg:bg-transparent space-y-2">
          <Button
            onClick={() => setPreviewMode(true)}
            variant="outline"
            className="w-full gap-2"
          >
            <Eye className="w-4 h-4" />
            Full Preview
          </Button>
          <Button
            onClick={handleSave}
            disabled={isSaving}
            className="w-full gap-2 bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600"
          >
            <Save className="w-4 h-4" />
            {isSaving ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>
      </div>

      {/* Right Panel - Live Preview */}
      <div className="lg:col-span-2 hidden lg:flex flex-col pb-4">
        <div className="mb-2 text-xs text-slate-400">Live Preview</div>
        <div className="flex-1 border border-slate-700 rounded-lg overflow-hidden">
          <LivePreview storefront={customStorefront} branding={branding} layout={layout} />
        </div>
      </div>
    </div>
  );
}