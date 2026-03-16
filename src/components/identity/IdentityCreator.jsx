import React, { useState } from 'react';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';

const roleOptions = [
  { value: 'Student', label: '🎓 Student' },
  { value: 'Professional', label: '💼 Professional' },
  { value: 'Business', label: '🏢 Business Owner' },
  { value: 'Creator', label: '✨ Content Creator' },
  { value: 'Freelancer', label: '🛠️ Freelancer' },
  { value: 'Researcher', label: '🔬 Researcher' },
  { value: 'Influencer', label: '📱 Influencer' },
  { value: 'Tester', label: '🧪 Beta Tester' },
  { value: 'Reviewer', label: '⭐ Reviewer' }
];

export default function IdentityCreator({ onClose, onCreate, isLoading }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [roleLabel, setRoleLabel] = useState('Freelancer');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!name.trim() || !email.trim()) return;

    onCreate({
      name: name.trim(),
      email: email.trim(),
      role_label: roleLabel
    });
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <Card className="bg-slate-900 border-slate-700 w-full max-w-md p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-white">Create New Identity</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-xs font-medium text-slate-300">Name</label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Alex Johnson"
              className="mt-1.5"
              disabled={isLoading}
            />
          </div>

          <div>
            <label className="text-xs font-medium text-slate-300">Email</label>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="e.g., alex@example.com"
              className="mt-1.5"
              disabled={isLoading}
            />
          </div>

          <div>
            <label className="text-xs font-medium text-slate-300">Persona Type</label>
            <select
              value={roleLabel}
              onChange={(e) => setRoleLabel(e.target.value)}
              className="w-full mt-1.5 px-3 py-2 rounded-md border border-slate-700 bg-slate-950 text-white text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500"
              disabled={isLoading}
            >
              {roleOptions.map(({ value, label }) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>

          <div className="bg-slate-950 rounded-lg p-3 border border-slate-800">
            <p className="text-xs text-slate-400">
              ✨ AI will generate unique bio, tagline, skills, and platform profiles for this identity automatically.
            </p>
          </div>

          <div className="flex gap-3">
            <Button type="button" variant="outline" onClick={onClose} disabled={isLoading} className="flex-1">
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading || !name.trim() || !email.trim()} className="flex-1 bg-emerald-600 hover:bg-emerald-700">
              {isLoading ? 'Creating...' : 'Create Identity'}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}