import React, { useState } from 'react';
import { Volume2, Settings, AlertCircle, Zap } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export default function BridgeSystemRefinements({ audioEngine, postProcessing }) {
  const [showSettings, setShowSettings] = useState(false);
  const [audioSettings, setAudioSettings] = useState({
    masterVolume: 0.7,
    ambientVolume: 0.3,
    alertVolume: 0.8,
    uiVolume: 0.6
  });
  const [postProcessSettings, setPostProcessSettings] = useState({
    bloomEnabled: true,
    bloomStrength: 1.2,
    scanlineEnabled: true,
    glitchEnabled: false
  });

  const handleAudioChange = (category, value) => {
    const newSettings = { ...audioSettings, [category]: value };
    setAudioSettings(newSettings);
    
    if (audioEngine) {
      if (category === 'masterVolume') {
        audioEngine.setMasterVolume(value);
      } else {
        const catName = category.replace('Volume', '');
        audioEngine.setCategoryVolume(catName, value);
      }
    }
  };

  const handlePostProcessChange = (setting, value) => {
    const newSettings = { ...postProcessSettings, [setting]: value };
    setPostProcessSettings(newSettings);
    
    if (postProcessing) {
      postProcessing.updateSetting(setting, value);
    }
  };

  return (
    <div className="fixed top-20 right-4 pointer-events-auto">
      <Button
        variant="ghost"
        size="icon"
        onClick={() => setShowSettings(!showSettings)}
        className="glass-card mb-2"
      >
        <Settings className="w-5 h-5 text-cyber-cyan" />
      </Button>

      {showSettings && (
        <Card className="glass-card p-4 w-80 space-y-4 bg-slate-950/95 border-cyan-500/30">
          <div className="text-sm font-orbitron text-cyber-cyan mb-4">SYSTEM REFINEMENTS</div>

          {/* Audio Settings */}
          <div className="space-y-3 border-b border-cyan-500/20 pb-4">
            <div className="flex items-center gap-2 text-xs text-cyber-cyan">
              <Volume2 className="w-4 h-4" />
              <span className="font-mono">AUDIO CONTROL</span>
            </div>
            
            {Object.entries(audioSettings).map(([key, value]) => (
              <div key={key} className="space-y-1">
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>{key.replace(/([A-Z])/g, ' $1').trim()}</span>
                  <span className="text-cyber-cyan">{Math.round(value * 100)}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={value}
                  onChange={(e) => handleAudioChange(key, parseFloat(e.target.value))}
                  className="w-full h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-cyan-500"
                />
              </div>
            ))}
          </div>

          {/* Post-Processing Settings */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-xs text-cyber-cyan">
              <Zap className="w-4 h-4" />
              <span className="font-mono">VISUAL EFFECTS</span>
            </div>
            
            <div className="space-y-2">
              {Object.entries(postProcessSettings).map(([key, value]) => (
                <label key={key} className="flex items-center gap-2 cursor-pointer text-xs">
                  <input
                    type="checkbox"
                    checked={typeof value === 'boolean' ? value : false}
                    onChange={(e) => {
                      if (typeof postProcessSettings[key] === 'boolean') {
                        handlePostProcessChange(key, e.target.checked);
                      }
                    }}
                    className="w-4 h-4 accent-cyan-500"
                  />
                  <span className="text-muted-foreground">{key.replace(/([A-Z])/g, ' $1').trim()}</span>
                </label>
              ))}
            </div>

            {/* Bloom Strength Slider (if enabled) */}
            {postProcessSettings.bloomEnabled && (
              <div className="space-y-1 mt-2">
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Bloom Strength</span>
                  <span className="text-cyber-cyan">{postProcessSettings.bloomStrength.toFixed(1)}</span>
                </div>
                <input
                  type="range"
                  min="0.5"
                  max="2"
                  step="0.1"
                  value={postProcessSettings.bloomStrength}
                  onChange={(e) => {
                    const val = parseFloat(e.target.value);
                    handlePostProcessChange('bloomStrength', val);
                    setPostProcessSettings(prev => ({ ...prev, bloomStrength: val }));
                  }}
                  className="w-full h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-cyan-500"
                />
              </div>
            )}
          </div>

          {/* System Status */}
          <div className="text-xs text-green-400 flex items-center gap-2 pt-2">
            <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
            <span>All Systems Operational</span>
          </div>
        </Card>
      )}
    </div>
  );
}