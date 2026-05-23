// ================================================================
// IMMORTAIL™ — MEMORIES ROUTE
// Metallic gold/silver on black. Browse, create, star memories.
// ================================================================

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { getState } from '@/core/storage.js';
import { eventBus } from '@/core/eventBus.js';
import { EVENT } from '@/core/constants.js';
import {
  createMemory, loadMemoriesForDog, deleteMemory, updateMemory, searchMemories
} from '@/systems/memorySystem/memorySystem.js';
import { showToast } from '@/ui/feedback/Toast.jsx';
import styles from './Memories.module.css';

export default function Memories() {
  const [dog] = useState(getState().activeDog);
  const [memories, setMemories] = useState([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filtered, setFiltered] = useState([]);
  const [selected, setSelected] = useState(null);
  const [form, setForm] = useState({ title: '', note: '', tags: '', date: '' });

  useEffect(() => {
    if (!dog) return;
    setLoading(true);
    loadMemoriesForDog(dog.id)
      .then(mems => { setMemories(mems); setFiltered(mems); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [dog?.id]);

  useEffect(() => {
    const off = eventBus.on(EVENT.MEMORY_SAVED, () => {
      if (dog) loadMemoriesForDog(dog.id).then(mems => {
        setMemories(mems);
        setFiltered(applyFilter(mems, searchQuery));
      });
    });
    return off;
  }, [dog?.id, searchQuery]);

  const applyFilter = (mems, q) => {
    if (!q.trim()) return mems;
    const lq = q.toLowerCase();
    return mems.filter(m =>
      m.title?.toLowerCase().includes(lq) ||
      m.note?.toLowerCase().includes(lq) ||
      m.tags?.some(t => t.toLowerCase().includes(lq))
    );
  };

  const handleSearch = useCallback((q) => {
    setSearchQuery(q);
    if (!q.trim()) { setFiltered(memories); return; }
    searchMemories(q).then(r => setFiltered(r.length ? r : applyFilter(memories, q)));
  }, [memories]);

  const handleCreate = useCallback(async () => {
    if (!dog || (!form.note.trim() && !form.title.trim())) {
      showToast('Add a title or note', 'error'); return;
    }
    try {
      const tags = form.tags.split(',').map(t => t.trim()).filter(Boolean);
      await createMemory(dog.id, {
        title: form.title, note: form.note, tags,
        date: form.date ? new Date(form.date).getTime() : Date.now(),
        type: 'note',
      });
      setForm({ title: '', note: '', tags: '', date: '' });
      setCreating(false);
      showToast('Memory saved ✦', 'success');
    } catch (err) { showToast(`Failed: ${err.message}`, 'error'); }
  }, [dog, form]);

  const handleDelete = useCallback(async (id) => {
    try {
      await deleteMemory(id);
      setMemories(m => m.filter(x => x.id !== id));
      setFiltered(m => m.filter(x => x.id !== id));
      setSelected(null);
      showToast('Memory removed', 'success');
    } catch { showToast('Failed to remove', 'error'); }
  }, []);

  const handleToggleStar = useCallback(async (memory) => {
    try {
      const updated = await updateMemory(memory.id, { starred: !memory.starred });
      const update = m => m.map(x => x.id === memory.id ? updated : x);
      setMemories(update); setFiltered(update);
      if (selected?.id === memory.id) setSelected(updated);
    } catch {}
  }, [selected]);

  if (!dog) return <div className={styles.empty}><span>🐾</span><p>No companion loaded.</p></div>;

  return (
    <div className={styles.container}>

      {/* HEADER */}
      <motion.div className={styles.header} initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className={styles.title}>Memories</h1>
        <motion.button
          className={styles.addBtn}
          onClick={() => setCreating(c => !c)}
          whileTap={{ scale: 0.88 }}
          animate={{ rotate: creating ? 45 : 0 }}
          transition={{ duration: 0.2 }}
        >+</motion.button>
      </motion.div>

      {/* CREATE FORM */}
      <AnimatePresence>
        {creating && (
          <motion.div
            className={styles.createForm}
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.28 }}
          >
            <div className={styles.formInner}>
              <input className={styles.formInput} placeholder="Title (optional)"
                value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
              <textarea className={styles.formTextarea} placeholder="What do you remember…"
                value={form.note} onChange={e => setForm(f => ({ ...f, note: e.target.value }))} rows={3} />
              <div className={styles.formRow}>
                <input className={styles.formInput} placeholder="Tags, comma separated"
                  value={form.tags} onChange={e => setForm(f => ({ ...f, tags: e.target.value }))} />
                <input className={styles.formInput} type="date"
                  value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} />
              </div>
              <motion.button className={styles.saveBtn} onClick={handleCreate} whileTap={{ scale: 0.95 }}>
                Save Memory
              </motion.button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* SEARCH */}
      <div className={styles.searchBar}>
        <span className={styles.searchIcon}>⌕</span>
        <input className={styles.searchInput} placeholder="Search memories…"
          value={searchQuery} onChange={e => handleSearch(e.target.value)} />
      </div>

      {/* CONTENT */}
      {loading ? (
        <div className={styles.empty}>
          <motion.div animate={{ opacity: [0.3, 1, 0.3] }} transition={{ duration: 1.5, repeat: Infinity }}>
            <span className={styles.emptyIcon}>🐾</span>
          </motion.div>
        </div>
      ) : filtered.length === 0 ? (
        <div className={styles.empty}>
          <span className={styles.emptyIcon}>🕯️</span>
          <p className={styles.emptyText}>
            {searchQuery ? 'No matching memories' : `Start capturing ${dog.name}'s moments`}
          </p>
        </div>
      ) : (
        <motion.div className={styles.grid} layout>
          <AnimatePresence>
            {filtered.map((memory, i) => (
              <MemoryCard
                key={memory.id}
                memory={memory}
                index={i}
                onClick={() => setSelected(memory)}
                onStar={() => handleToggleStar(memory)}
              />
            ))}
          </AnimatePresence>
        </motion.div>
      )}

      {/* DETAIL MODAL */}
      <AnimatePresence>
        {selected && (
          <motion.div className={styles.detailOverlay}
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={() => setSelected(null)}
          >
            <motion.div className={styles.detailCard}
              initial={{ y: 60, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 60, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 320, damping: 30 }}
              onClick={e => e.stopPropagation()}
            >
              {/* Gold line top */}
              <div className={styles.detailGoldLine} />

              <div className={styles.detailHeader}>
                <h2 className={styles.detailTitle}>{selected.title || 'Memory'}</h2>
                <button className={styles.closeBtn} onClick={() => setSelected(null)}>✕</button>
              </div>

              {selected.date && (
                <p className={styles.detailDate}>
                  {new Date(selected.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
                </p>
              )}

              {selected.note && <p className={styles.detailNote}>{selected.note}</p>}

              {selected.tags?.length > 0 && (
                <div className={styles.tagRow}>
                  {selected.tags.map(tag => <span key={tag} className={styles.tag}>{tag}</span>)}
                </div>
              )}

              <div className={styles.detailActions}>
                <button className={`${styles.detailBtn} ${selected.starred ? styles.starred : ''}`}
                  onClick={() => handleToggleStar(selected)}>
                  {selected.starred ? '★ Starred' : '☆ Star'}
                </button>
                <button className={`${styles.detailBtn} ${styles.danger}`}
                  onClick={() => handleDelete(selected.id)}>
                  Remove
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── MEMORY CARD ──────────────────────────────────────────────────
function MemoryCard({ memory, index, onClick, onStar }) {
  const date = memory.date
    ? new Date(memory.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
    : null;
  return (
    <motion.div
      className={styles.memoryCard}
      onClick={onClick}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ delay: index * 0.04 }}
      whileTap={{ scale: 0.97 }}
      layout
    >
      <div className={styles.cardTop}>
        {memory.title && <h3 className={styles.cardTitle}>{memory.title}</h3>}
        <button
          className={`${styles.starBtn} ${memory.starred ? styles.starActive : ''}`}
          onClick={e => { e.stopPropagation(); onStar(); }}
        >
          {memory.starred ? '★' : '☆'}
        </button>
      </div>
      {memory.note && <p className={styles.cardNote}>{memory.note}</p>}
      <div className={styles.cardBottom}>
        {date && <span className={styles.cardDate}>{date}</span>}
        {memory.tags?.length > 0 && (
          <div className={styles.cardTags}>
            {memory.tags.slice(0, 2).map(t => <span key={t} className={styles.tag}>{t}</span>)}
          </div>
        )}
      </div>
    </motion.div>
  );
}
