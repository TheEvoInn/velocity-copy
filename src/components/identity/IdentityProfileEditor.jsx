import React, { useState } from 'react';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function IdentityProfileEditor({ identity, onClose, onSave }) {
  const [formData, setFormData] = useState({
    name: identity?.name || '',
    email: identity?.email || '',
    phone: identity?.phone || '',
    tagline: identity?.tagline || '',
    bio: identity?.bio || '',
    role_label: identity?.role_label || '',
    communication_tone: identity?.communication_tone || 'professional',
    email_signature: identity?.email_signature || '',
    proposal_style: identity?.proposal_style || '',
    skills: Array.isArray(identity?.skills) ? identity.skills.join(', ') : '',
    preferred_platforms: Array.isArray(identity?.preferred_platforms) ? identity.preferred_platforms.join(', ') : '',
    preferred_categories: Array.isArray(identity?.preferred_categories) ? identity.preferred_categories.join(', ') : '',
    spending_limit_per_task: identity?.spending_limit_per_task || 100,
    avatar_url: identity?.avatar_url || '',
    color: identity?.color || '#06b6d4',
  });

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSave = () => {
    const saveData = {
      ...formData,
      skills: formData.skills ? formData.skills.split(',').map(s => s.trim()).filter(Boolean) : [],
      preferred_platforms: formData.preferred_platforms ? formData.preferred_platforms.split(',').map(s => s.trim()).filter(Boolean) : [],
      preferred_categories: formData.preferred_categories ? formData.preferred_categories.split(',').map(s => s.trim()).filter(Boolean) : [],
    };
    onSave(saveData);
  };

  const sections = [
    {
      title: 'Basic Information',
      fields: [
        { label: 'Name', key: 'name', type: 'text', required: true },
        { label: 'Email', key: 'email', type: 'email' },
        { label: 'Phone', key: 'phone', type: 'tel' },
        { label: 'Role/Title', key: 'role_label', type: 'text', placeholder: 'e.g., Freelancer, Sales Agent' },
      ]
    },
    {
      title: 'Branding & Identity',
      fields: [
        { label: 'Tagline', key: 'tagline', type: 'text', placeholder: 'Short tagline or headline' },
        { label: 'Bio', key: 'bio', type: 'textarea', placeholder: 'Professional bio or description' },
        { label: 'Avatar URL', key: 'avatar_url', type: 'text', placeholder: 'https://...' },
        { label: 'Brand Color (Hex)', key: 'color', type: 'color' },
      ]
    },
    {
      title: 'Communication Style',
      fields: [
        { 
          label: 'Communication Tone', 
          key: 'communication_tone', 
          type: 'select',
          options: ['professional', 'friendly', 'authoritative', 'casual', 'technical', 'persuasive', 'empathetic']
        },
        { label: 'Email Signature', key: 'email_signature', type: 'textarea', placeholder: 'Email closing signature' },
        { label: 'Proposal Style', key: 'proposal_style', type: 'textarea', placeholder: 'How you present proposals' },
      ]
    },
    {
      title: 'Skills & Specializations',
      fields: [
        { label: 'Skills (comma-separated)', key: 'skills', type: 'textarea', placeholder: 'e.g., Writing, Design, Marketing' },
        { label: 'Preferred Platforms (comma-separated)', key: 'preferred_platforms', type: 'textarea', placeholder: 'e.g., Upwork, Fiverr, LinkedIn' },
        { label: 'Preferred Categories (comma-separated)', key: 'preferred_categories', type: 'textarea', placeholder: 'e.g., freelance, arbitrage, service' },
      ]
    },
    {
      title: 'Autopilot Settings',
      fields: [
        { label: 'Spending Limit Per Task ($)', key: 'spending_limit_per_task', type: 'number', min: 0, step: 10 },
      ]
    },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm overflow-y-auto">
      <Card className="glass-card w-full max-w-3xl mx-4 my-8">
        <CardHeader className="flex flex-row items-center justify-between sticky top-0 bg-slate-900/80 backdrop-blur">
          <CardTitle className="text-xl">Edit Identity Profile</CardTitle>
          <button 
            onClick={onClose}
            className="text-slate-400 hover:text-white transition-colors text-2xl leading-none"
          >
            ×
          </button>
        </CardHeader>

        <CardContent className="space-y-6 py-6">
          {sections.map((section, idx) => (
            <div key={idx} className="space-y-4 pb-6 border-b border-slate-700/50 last:border-b-0">
              <h3 className="text-sm font-bold text-cyan-400 uppercase tracking-wider">{section.title}</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {section.fields.map(field => (
                  <div 
                    key={field.key} 
                    className={field.type === 'textarea' ? 'md:col-span-2' : ''}
                  >
                    <label className="text-sm font-semibold text-white block mb-2">
                      {field.label}
                      {field.required && <span className="text-red-400 ml-1">*</span>}
                    </label>
                    
                    {field.type === 'textarea' ? (
                      <textarea
                        value={formData[field.key]}
                        onChange={(e) => handleChange(field.key, e.target.value)}
                        placeholder={field.placeholder}
                        className="w-full px-3 py-2 rounded-lg bg-slate-900/60 border border-slate-700/60 text-white text-sm h-20 resize-none focus:border-cyan-500/60 focus:outline-none transition-colors"
                      />
                    ) : field.type === 'select' ? (
                      <select
                        value={formData[field.key]}
                        onChange={(e) => handleChange(field.key, e.target.value)}
                        className="w-full px-3 py-2 rounded-lg bg-slate-900/60 border border-slate-700/60 text-white text-sm focus:border-cyan-500/60 focus:outline-none transition-colors"
                      >
                        {field.options.map(opt => (
                          <option key={opt} value={opt} className="bg-slate-900 text-white">
                            {opt.charAt(0).toUpperCase() + opt.slice(1)}
                          </option>
                        ))}
                      </select>
                    ) : field.type === 'color' ? (
                      <div className="flex gap-2">
                        <input
                          type="color"
                          value={formData[field.key]}
                          onChange={(e) => handleChange(field.key, e.target.value)}
                          className="w-12 h-10 rounded-lg cursor-pointer"
                        />
                        <input
                          type="text"
                          value={formData[field.key]}
                          onChange={(e) => handleChange(field.key, e.target.value)}
                          className="flex-1 px-3 py-2 rounded-lg bg-slate-900/60 border border-slate-700/60 text-white text-sm focus:border-cyan-500/60 focus:outline-none transition-colors font-mono"
                        />
                      </div>
                    ) : (
                      <input
                        type={field.type}
                        value={formData[field.key]}
                        onChange={(e) => handleChange(field.key, e.target.value)}
                        placeholder={field.placeholder}
                        min={field.min}
                        step={field.step}
                        className="w-full px-3 py-2 rounded-lg bg-slate-900/60 border border-slate-700/60 text-white text-sm focus:border-cyan-500/60 focus:outline-none transition-colors"
                      />
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </CardContent>

        <div className="sticky bottom-0 bg-slate-900/80 backdrop-blur px-6 py-4 border-t border-slate-700/50 flex gap-3">
          <Button 
            onClick={onClose}
            variant="outline"
            className="flex-1"
          >
            Cancel
          </Button>
          <Button 
            onClick={handleSave}
            className="flex-1"
            style={{ background: 'linear-gradient(135deg, #7c3aed, #06b6d4)' }}
          >
            Save Profile
          </Button>
        </div>
      </Card>
    </div>
  );
}