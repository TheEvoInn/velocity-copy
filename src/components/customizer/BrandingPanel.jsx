import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Palette, Type } from 'lucide-react';

export default function BrandingPanel({ branding, onChange }) {
  return (
    <div className="space-y-4">
      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm">
            <Palette className="w-4 h-4" />
            Colors
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Primary Color */}
          <div>
            <label className="text-xs font-medium text-slate-300 block mb-2">
              Primary Color
            </label>
            <div className="flex gap-2">
              <input
                type="color"
                value={branding.primaryColor}
                onChange={(e) => onChange({ ...branding, primaryColor: e.target.value })}
                className="w-12 h-10 rounded cursor-pointer"
              />
              <input
                type="text"
                value={branding.primaryColor}
                onChange={(e) => onChange({ ...branding, primaryColor: e.target.value })}
                className="flex-1 px-3 py-2 bg-slate-800 border border-slate-700 rounded text-xs text-white"
              />
            </div>
          </div>

          {/* Secondary Color */}
          <div>
            <label className="text-xs font-medium text-slate-300 block mb-2">
              Secondary Color
            </label>
            <div className="flex gap-2">
              <input
                type="color"
                value={branding.secondaryColor}
                onChange={(e) => onChange({ ...branding, secondaryColor: e.target.value })}
                className="w-12 h-10 rounded cursor-pointer"
              />
              <input
                type="text"
                value={branding.secondaryColor}
                onChange={(e) => onChange({ ...branding, secondaryColor: e.target.value })}
                className="flex-1 px-3 py-2 bg-slate-800 border border-slate-700 rounded text-xs text-white"
              />
            </div>
          </div>

          {/* Accent Color */}
          <div>
            <label className="text-xs font-medium text-slate-300 block mb-2">
              Accent Color
            </label>
            <div className="flex gap-2">
              <input
                type="color"
                value={branding.accentColor}
                onChange={(e) => onChange({ ...branding, accentColor: e.target.value })}
                className="w-12 h-10 rounded cursor-pointer"
              />
              <input
                type="text"
                value={branding.accentColor}
                onChange={(e) => onChange({ ...branding, accentColor: e.target.value })}
                className="flex-1 px-3 py-2 bg-slate-800 border border-slate-700 rounded text-xs text-white"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm">
            <Type className="w-4 h-4" />
            Typography
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Font Family */}
          <div>
            <label className="text-xs font-medium text-slate-300 block mb-2">
              Font Family
            </label>
            <select
              value={branding.fontFamily}
              onChange={(e) => onChange({ ...branding, fontFamily: e.target.value })}
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded text-xs text-white"
            >
              <option value="sans">Sans Serif (Modern)</option>
              <option value="serif">Serif (Classic)</option>
            </select>
          </div>

          {/* Heading Size */}
          <div>
            <label className="text-xs font-medium text-slate-300 block mb-2">
              Heading Size: {branding.headingSize || 'large'}
            </label>
            <input
              type="range"
              min="small"
              max="large"
              value={branding.headingSize || 'large'}
              onChange={(e) => onChange({ ...branding, headingSize: e.target.value })}
              className="w-full"
            />
          </div>

          {/* Text Size */}
          <div>
            <label className="text-xs font-medium text-slate-300 block mb-2">
              Body Text Size: {branding.textSize || 'medium'}
            </label>
            <input
              type="range"
              min="small"
              max="large"
              value={branding.textSize || 'medium'}
              onChange={(e) => onChange({ ...branding, textSize: e.target.value })}
              className="w-full"
            />
          </div>
        </CardContent>
      </Card>

      {/* Preset Themes */}
      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="text-sm">Quick Themes</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <button
            onClick={() => onChange({
              ...branding,
              primaryColor: '#06b6d4',
              secondaryColor: '#0ea5e9',
              accentColor: '#10b981'
            })}
            className="w-full px-3 py-2 rounded text-xs font-medium bg-cyan-500/20 border border-cyan-500/50 text-cyan-400 hover:bg-cyan-500/30 transition"
          >
            Ocean
          </button>
          <button
            onClick={() => onChange({
              ...branding,
              primaryColor: '#ec4899',
              secondaryColor: '#f43f5e',
              accentColor: '#fbbf24'
            })}
            className="w-full px-3 py-2 rounded text-xs font-medium bg-pink-500/20 border border-pink-500/50 text-pink-400 hover:bg-pink-500/30 transition"
          >
            Vibrant
          </button>
          <button
            onClick={() => onChange({
              ...branding,
              primaryColor: '#6366f1',
              secondaryColor: '#a855f7',
              accentColor: '#f59e0b'
            })}
            className="w-full px-3 py-2 rounded text-xs font-medium bg-indigo-500/20 border border-indigo-500/50 text-indigo-400 hover:bg-indigo-500/30 transition"
          >
            Premium
          </button>
        </CardContent>
      </Card>
    </div>
  );
}