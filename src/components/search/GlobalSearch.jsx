import React, { useState, useEffect, useRef } from 'react';
import { Search, X, Zap } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { searchEntities } from '@/utils/fuzzyMatch';
import { Link } from 'react-router-dom';

export default function GlobalSearch() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef(null);
  const containerRef = useRef(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Search across entities
  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }

    setLoading(true);
    const searchAsync = async () => {
      try {
        const [opportunities, identities, transactions] = await Promise.all([
          base44.entities.Opportunity?.filter?.({}, '-created_date', 20).catch(() => []) || [],
          base44.entities.AIIdentity?.list?.().catch(() => []) || [],
          base44.entities.CryptoTransaction?.list?.().catch(() => []) || []
        ]);

        const allResults = [
          ...opportunities.map(o => ({ ...o, type: 'opportunity', title: o.title || o.opportunity_type })),
          ...identities.map(i => ({ ...i, type: 'identity', title: i.name })),
          ...transactions.map(t => ({ ...t, type: 'transaction', title: `${t.token_symbol} - $${t.value_usd}` }))
        ];

        const matched = searchEntities(query, allResults);
        setResults(matched);
      } catch (error) {
        console.error('Search failed:', error);
      } finally {
        setLoading(false);
      }
    };

    searchAsync();
  }, [query]);

  const getResultIcon = (type) => {
    const colors = {
      opportunity: 'text-cyber-gold',
      identity: 'text-cyber-magenta',
      transaction: 'text-cyber-cyan'
    };
    return <Zap className={`w-3 h-3 ${colors[type] || 'text-muted-foreground'}`} />;
  };

  const getResultPath = (result) => {
    const pathMap = {
      opportunity: `/Execution?id=${result.id}`,
      identity: `/IdentityManager?id=${result.id}`,
      transaction: `/Finance?id=${result.id}`
    };
    return pathMap[result.type] || '#';
  };

  return (
    <div ref={containerRef} className="relative flex-1 max-w-xs">
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          placeholder="Search entities..."
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          className="w-full px-3 py-1.5 pl-8 text-xs rounded bg-slate-900/50 border border-slate-700 text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/20"
        />
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-500" />
        {query && (
          <button
            onClick={() => {
              setQuery('');
              setResults([]);
              inputRef.current?.focus();
            }}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
          >
            <X className="w-3 h-3" />
          </button>
        )}
      </div>

      {/* Results Dropdown */}
      {isOpen && query && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-slate-900 border border-slate-700 rounded shadow-xl z-50 max-h-80 overflow-y-auto">
          {loading ? (
            <div className="p-3 text-xs text-slate-400 text-center">Searching...</div>
          ) : results.length === 0 ? (
            <div className="p-3 text-xs text-slate-400 text-center">No results found</div>
          ) : (
            <div className="py-1">
              {results.map((result) => (
                <Link key={`${result.type}-${result.id}`} to={getResultPath(result)}>
                  <button className="w-full px-3 py-2 text-left text-xs hover:bg-slate-800/50 transition-colors flex items-start gap-2 border-b border-slate-800/30 last:border-0">
                    <div className="mt-0.5">
                      {getResultIcon(result.type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-slate-200 truncate font-medium">{result.title}</div>
                      <div className="text-slate-500 text-xs capitalize">{result.type}</div>
                    </div>
                  </button>
                </Link>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}