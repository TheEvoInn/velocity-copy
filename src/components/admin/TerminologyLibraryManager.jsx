import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { CheckCircle, AlertTriangle, Zap, Search } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';

export default function TerminologyLibraryManager() {
  const [libraryEntries, setLibraryEntries] = useState([]);
  const [discoveredTerms, setDiscoveredTerms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const { user } = useAuth();

  useEffect(() => {
    if (user?.role !== 'admin') return;
    loadData();
  }, [user]);

  const loadData = async () => {
    try {
      const [libResult, discResult] = await Promise.all([
        base44.entities.TerminologyLibrary.list('-confidence_score', 100),
        base44.entities.DiscoveredTerms.filter(
          { status: 'pending_admin_review' },
          '-created_date',
          50
        ),
      ]);
      setLibraryEntries(libResult);
      setDiscoveredTerms(discResult);
    } catch (err) {
      console.error('Failed to load data:', err);
    } finally {
      setLoading(false);
    }
  };

  const approveDiscovery = async (discoveryId, fieldType) => {
    try {
      // Update discovery record
      await base44.entities.DiscoveredTerms.update(discoveryId, {
        status: 'approved',
        approved_by: user.email,
        approved_at: new Date().toISOString(),
        best_match_type: fieldType,
      });

      // Invoke auto-add to library
      await base44.functions.invoke('autoDiscoverTerms', {
        field_labels: [discoveryId],
      });

      setDiscoveredTerms(prev => prev.filter(d => d.id !== discoveryId));
    } catch (err) {
      alert(`Failed to approve: ${err.message}`);
    }
  };

  const filtered = libraryEntries.filter(
    (e) =>
      e.universal_field_type.includes(searchTerm.toLowerCase()) ||
      e.known_labels?.some((l) => l.label.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  if (loading) return <div className="text-slate-400">Loading...</div>;

  if (user?.role !== 'admin') {
    return <div className="text-red-400">Admin access required</div>;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white mb-2">Terminology Library Manager</h1>
        <p className="text-slate-400 text-sm">
          Manage field type mappings, approve discovered terms, and maintain the self-expanding intelligence library
        </p>
      </div>

      {/* Discovered Terms Pending Review */}
      {discoveredTerms.length > 0 && (
        <Card className="bg-slate-800 border-amber-500/30 p-4">
          <div className="flex items-center gap-2 mb-4">
            <AlertTriangle className="w-5 h-5 text-amber-400" />
            <h2 className="font-bold text-amber-300">{discoveredTerms.length} New Terms Pending Review</h2>
          </div>
          <div className="space-y-2">
            {discoveredTerms.map((term) => (
              <div key={term.id} className="bg-slate-700/50 p-3 rounded-lg flex items-center justify-between gap-2 text-sm">
                <div>
                  <div className="text-white font-mono">{term.field_label}</div>
                  <div className="text-xs text-slate-400">{term.source_platform} • {term.match_confidence}% match</div>
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => approveDiscovery(term.id, term.best_match_type)}
                    className="text-xs h-7"
                  >
                    Approve as <strong className="ml-1">{term.best_match_type}</strong>
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Library Entries */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <Zap className="w-5 h-5 text-cyan-400" />
          <h2 className="font-bold text-white">Library Entries ({filtered.length})</h2>
          <div className="ml-auto flex-1 max-w-xs">
            <Input
              placeholder="Search field types..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="h-8 text-xs bg-slate-700 border-slate-600"
            />
          </div>
        </div>

        <div className="space-y-2 max-h-[600px] overflow-y-auto">
          {filtered.map((entry) => (
            <Card key={entry.id} className="bg-slate-800 border-slate-700 p-4">
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-emerald-400" />
                  <span className="font-mono font-bold text-cyan-300">{entry.universal_field_type}</span>
                  <span className="text-xs bg-slate-700 px-2 py-0.5 rounded text-slate-300">
                    {entry.known_labels?.length || 0} labels
                  </span>
                </div>
                <span className="text-xs text-slate-400">Confidence: {entry.confidence_score}%</span>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs text-slate-300">
                <div>
                  <strong className="text-slate-400">Labels:</strong>
                  <div className="mt-1 space-y-0.5">
                    {(entry.known_labels || []).slice(0, 3).map((l, i) => (
                      <div key={i} className="text-slate-400">• {l.label}</div>
                    ))}
                    {(entry.known_labels?.length || 0) > 3 && (
                      <div className="text-slate-500">+{entry.known_labels.length - 3} more</div>
                    )}
                  </div>
                </div>

                <div>
                  <strong className="text-slate-400">API Conventions:</strong>
                  <div className="mt-1 space-y-0.5">
                    {(entry.api_naming_conventions || []).slice(0, 3).map((c, i) => (
                      <div key={i} className="text-slate-400 font-mono">• {c}</div>
                    ))}
                    {(entry.api_naming_conventions?.length || 0) > 3 && (
                      <div className="text-slate-500">+{entry.api_naming_conventions.length - 3} more</div>
                    )}
                  </div>
                </div>
              </div>

              {entry.user_data_field_mapping && (
                <div className="mt-3 pt-3 border-t border-slate-700 text-xs text-slate-400">
                  <strong className="text-slate-300">User Data Source:</strong> {entry.user_data_field_mapping.source}.
                  {entry.user_data_field_mapping.field}
                </div>
              )}
            </Card>
          ))}
        </div>
      </div>

      {/* Stats */}
      <Card className="bg-slate-800 border-slate-700 p-4">
        <h3 className="font-bold text-white mb-3">Library Statistics</h3>
        <div className="grid grid-cols-4 gap-4 text-center text-sm">
          <div>
            <div className="text-2xl font-bold text-cyan-400">{libraryEntries.length}</div>
            <div className="text-xs text-slate-400">Field Types</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-emerald-400">
              {libraryEntries.reduce((sum, e) => sum + (e.known_labels?.length || 0), 0)}
            </div>
            <div className="text-xs text-slate-400">Known Labels</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-amber-400">{discoveredTerms.length}</div>
            <div className="text-xs text-slate-400">Pending Review</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-violet-400">
              {libraryEntries.reduce((sum, e) => sum + (e.api_naming_conventions?.length || 0), 0)}
            </div>
            <div className="text-xs text-slate-400">API Conventions</div>
          </div>
        </div>
      </Card>
    </div>
  );
}