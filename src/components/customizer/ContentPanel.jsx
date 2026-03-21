import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { FileText } from 'lucide-react';

export default function ContentPanel({ storefront, onChange }) {
  const handleFieldChange = (field, value) => {
    onChange({ ...storefront, [field]: value });
  };

  return (
    <div className="space-y-4">
      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm">
            <FileText className="w-4 h-4" />
            Hero Content
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <label className="text-xs font-medium text-slate-300 block mb-1">
              Page Title
            </label>
            <input
              type="text"
              value={storefront.headline || ''}
              onChange={(e) => handleFieldChange('headline', e.target.value)}
              placeholder="Your Product Title"
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded text-xs text-white placeholder-slate-500"
            />
          </div>

          <div>
            <label className="text-xs font-medium text-slate-300 block mb-1">
              Subheading
            </label>
            <input
              type="text"
              value={storefront.subheading || ''}
              onChange={(e) => handleFieldChange('subheading', e.target.value)}
              placeholder="Compelling value proposition"
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded text-xs text-white placeholder-slate-500"
            />
          </div>

          <div>
            <label className="text-xs font-medium text-slate-300 block mb-1">
              CTA Button Text
            </label>
            <input
              type="text"
              value={storefront.call_to_action || ''}
              onChange={(e) => handleFieldChange('call_to_action', e.target.value)}
              placeholder="Get Access Now"
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded text-xs text-white placeholder-slate-500"
            />
          </div>
        </CardContent>
      </Card>

      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="text-sm">Product Description</CardTitle>
        </CardHeader>
        <CardContent>
          <textarea
            value={storefront.description || ''}
            onChange={(e) => handleFieldChange('description', e.target.value)}
            placeholder="Write your product description and benefits here..."
            rows="5"
            className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded text-xs text-white placeholder-slate-500 resize-none"
          />
          <p className="text-[10px] text-slate-500 mt-1">
            {(storefront.description || '').length} characters
          </p>
        </CardContent>
      </Card>

      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="text-sm">Testimonial</CardTitle>
        </CardHeader>
        <CardContent>
          <textarea
            value={storefront.testimonial || ''}
            onChange={(e) => handleFieldChange('testimonial', e.target.value)}
            placeholder="Enter a customer testimonial quote..."
            rows="3"
            className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded text-xs text-white placeholder-slate-500 resize-none"
          />
        </CardContent>
      </Card>

      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="text-sm">Features ({storefront.features?.length || 0})</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {storefront.features?.map((feature, idx) => (
            <div key={idx} className="flex gap-2">
              <input
                type="text"
                value={feature}
                onChange={(e) => {
                  const newFeatures = [...(storefront.features || [])];
                  newFeatures[idx] = e.target.value;
                  handleFieldChange('features', newFeatures);
                }}
                className="flex-1 px-2 py-1.5 bg-slate-800 border border-slate-700 rounded text-xs text-white"
              />
              <button
                onClick={() => {
                  const newFeatures = storefront.features.filter((_, i) => i !== idx);
                  handleFieldChange('features', newFeatures);
                }}
                className="px-2 py-1.5 bg-red-500/20 border border-red-500/50 rounded text-xs text-red-400 hover:bg-red-500/30"
              >
                ✕
              </button>
            </div>
          ))}
          <button
            onClick={() => {
              const newFeatures = [...(storefront.features || []), 'New feature'];
              handleFieldChange('features', newFeatures);
            }}
            className="w-full px-3 py-2 bg-cyan-500/20 border border-cyan-500/50 rounded text-xs font-medium text-cyan-400 hover:bg-cyan-500/30"
          >
            + Add Feature
          </button>
        </CardContent>
      </Card>
    </div>
  );
}