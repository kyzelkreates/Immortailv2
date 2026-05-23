// ================================================================
// IMMORTAIL™ — MEMORY WORKER
// Handles heavy memory indexing and search off the main thread.
// ================================================================

let _memoryIndex = [];

self.onmessage = async (event) => {
  const { type, id, payload } = event.data;

  if (type === 'index') {
    _memoryIndex = payload.memories || [];
    self.postMessage({ type: 'indexed', id, count: _memoryIndex.length });
    return;
  }

  if (type === 'search') {
    try {
      const results = _search(payload.query, payload.limit || 10);
      self.postMessage({ type: 'results', id, results });
    } catch (err) {
      self.postMessage({ type: 'error', id, error: err.message });
    }
    return;
  }
};

function _search(query, limit) {
  if (!query || !_memoryIndex.length) return [];
  const q = query.toLowerCase();
  const scored = _memoryIndex
    .map(mem => ({
      ...mem,
      score: _score(mem, q)
    }))
    .filter(m => m.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
  return scored;
}

function _score(mem, query) {
  let score = 0;
  const fields = [mem.title, mem.note, mem.caption, ...(mem.tags || [])].filter(Boolean);
  for (const field of fields) {
    if (field.toLowerCase().includes(query)) score += field === mem.title ? 3 : 1;
  }
  return score;
}
