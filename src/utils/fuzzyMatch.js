// Simple fuzzy matching algorithm
export function fuzzyMatch(query, text) {
  const q = query.toLowerCase();
  const t = text.toLowerCase();
  
  let qIdx = 0;
  let score = 0;
  let matchCount = 0;

  for (let i = 0; i < t.length && qIdx < q.length; i++) {
    if (t[i] === q[qIdx]) {
      score += Math.max(0, 10 - i); // Higher score for earlier matches
      qIdx++;
      matchCount++;
    }
  }

  return qIdx === q.length ? { matched: true, score, matchCount } : null;
}

export function searchEntities(query, results) {
  if (!query.trim()) return [];
  
  return results
    .map(item => {
      const titleMatch = fuzzyMatch(query, item.title || item.name || '');
      const descMatch = fuzzyMatch(query, item.description || '');
      
      if (titleMatch || descMatch) {
        return {
          ...item,
          score: (titleMatch?.score || 0) + (descMatch?.score || 0),
          matchType: titleMatch ? 'title' : 'description'
        };
      }
      return null;
    })
    .filter(Boolean)
    .sort((a, b) => b.score - a.score)
    .slice(0, 10);
}