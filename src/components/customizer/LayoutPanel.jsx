import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Layout } from 'lucide-react';

export default function LayoutPanel({ layout, onChange }) {
  return (
    <div className="space-y-4">
      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm">
            <Layout className="w-4 h-4" />
            Page Sections
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* Features Section */}
          <div className="flex items-center justify-between">
            <label className="text-xs font-medium text-slate-300">Show Features</label>
            <button
              onClick={() => onChange({ ...layout, showFeatures: !layout.showFeatures })}
              className={`px-3 py-1 rounded text-xs font-medium transition ${
                layout.showFeatures
                  ? 'bg-cyan-500/20 border border-cyan-500/50 text-cyan-400'
                  : 'bg-slate-700/50 border border-slate-600 text-slate-400'
              }`}
            >
              {layout.showFeatures ? 'On' : 'Off'}
            </button>
          </div>

          {/* Testimonial Section */}
          <div className="flex items-center justify-between">
            <label className="text-xs font-medium text-slate-300">Show Testimonial</label>
            <button
              onClick={() => onChange({ ...layout, showTestimonial: !layout.showTestimonial })}
              className={`px-3 py-1 rounded text-xs font-medium transition ${
                layout.showTestimonial
                  ? 'bg-cyan-500/20 border border-cyan-500/50 text-cyan-400'
                  : 'bg-slate-700/50 border border-slate-600 text-slate-400'
              }`}
            >
              {layout.showTestimonial ? 'On' : 'Off'}
            </button>
          </div>

          {/* FAQ Section */}
          <div className="flex items-center justify-between">
            <label className="text-xs font-medium text-slate-300">Show FAQ</label>
            <button
              onClick={() => onChange({ ...layout, showFAQ: !layout.showFAQ })}
              className={`px-3 py-1 rounded text-xs font-medium transition ${
                layout.showFAQ
                  ? 'bg-cyan-500/20 border border-cyan-500/50 text-cyan-400'
                  : 'bg-slate-700/50 border border-slate-600 text-slate-400'
              }`}
            >
              {layout.showFAQ ? 'On' : 'Off'}
            </button>
          </div>
        </CardContent>
      </Card>

      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="text-sm">Feature Grid</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Feature Columns */}
          <div>
            <label className="text-xs font-medium text-slate-300 block mb-2">
              Column Layout: {layout.featureColumns || 3}
            </label>
            <div className="flex gap-2">
              {[2, 3, 4].map(cols => (
                <button
                  key={cols}
                  onClick={() => onChange({ ...layout, featureColumns: cols })}
                  className={`flex-1 px-3 py-2 rounded text-xs font-medium transition ${
                    layout.featureColumns === cols
                      ? 'bg-cyan-500/20 border border-cyan-500/50 text-cyan-400'
                      : 'bg-slate-700/50 border border-slate-600 text-slate-400 hover:bg-slate-700'
                  }`}
                >
                  {cols} Col
                </button>
              ))}
            </div>
          </div>

          {/* Feature Count */}
          <div>
            <label className="text-xs font-medium text-slate-300 block mb-2">
              Features to Show: {layout.featureCount || 6}
            </label>
            <input
              type="range"
              min="3"
              max="12"
              value={layout.featureCount || 6}
              onChange={(e) => onChange({ ...layout, featureCount: parseInt(e.target.value) })}
              className="w-full"
            />
          </div>
        </CardContent>
      </Card>

      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="text-sm">Hero Section</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Hero Height */}
          <div>
            <label className="text-xs font-medium text-slate-300 block mb-2">
              Hero Height: {layout.heroHeight || 'medium'}
            </label>
            <select
              value={layout.heroHeight || 'medium'}
              onChange={(e) => onChange({ ...layout, heroHeight: e.target.value })}
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded text-xs text-white"
            >
              <option value="small">Small</option>
              <option value="medium">Medium</option>
              <option value="large">Large</option>
              <option value="fullscreen">Fullscreen</option>
            </select>
          </div>

          {/* CTA Placement */}
          <div>
            <label className="text-xs font-medium text-slate-300 block mb-2">
              CTA Button Style
            </label>
            <select
              value={layout.ctaStyle || 'filled'}
              onChange={(e) => onChange({ ...layout, ctaStyle: e.target.value })}
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded text-xs text-white"
            >
              <option value="filled">Filled</option>
              <option value="outline">Outline</option>
              <option value="gradient">Gradient</option>
            </select>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}