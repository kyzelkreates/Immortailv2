// ================================================================
// IMMORTAIL™ — MEMORIES ROUTE
// Browse, search, create, and view memories.
// Each memory can have text, tags, date, and linked media.
// ================================================================

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { getState } from '@/core/storage.js';
import { eventBus } from '@/core/eventBus.js';
import { EVENT } from '@/core/constants.js';
import {
  createMemory, loadMemoriesForDog, deleteMemory, updateMemory, searchMemories
} from '@/systems/memorySystem/memorySystem.js';
import { getMedia } from '@/storage/indexedDb.js';
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
  const blobUrls = useRef([]);

  // New memory form
  const [form, setForm] = useState({ title: '', note: '', tags: '', date: '' });

  useEffect(() => {
    return () => { blobUrls.current.forEach(u => URL.revokeObjectURL(u)); };
  }, []);

  useEffect(() => {
    if (!dog) return;
    setLoading(true);
    loadMemoriesForDog(dog.id).then(mems => {
      setMemories(mems);
      setFiltered(mems);
    }).catch(() => {}).finally(() => setLoading(false));
  }, [dog?.id]);

  useEffect(() => {
    const off = eventBus.on(EVENT.MEMORY_SAVED, () => {
      if (dog) {
        loadMemoriesForDog(dog.id).then(mems => { setMemories(mems); setFiltered(applySearch(mems, searchQuery)); });
      }
    });
    return off;
  }, [dog?.id, searchQuery]);

  const applySearch = (mems, query) => {
    if (!query.trim()) return mems;
    const q = query.toLowerCase();
    return mems.filter(m =>
      m.title?.toLowerCase().includes(q) ||
      m.note?.toLowerCase().includes(q) ||
      m.tags?.some(t => t.toLowerCase().includes(q))
    );
  };

  const handleSearch = useCallback((q) => {
    setSearchQuery(q);
    if (!q.trim()) { setFiltered(memories); return; }
    searchMemories(q).then(results => {
      if (results.length > 0) setFiltered(results);
      else setFiltered(applySearch(memories, q));
    });
  }, [memories]);

  const handleCreate = useCallback(async () => {
    if (!dog || !form.note.trim() && !form.title.trim()) {
      showToast('Add a title or note', 'error'); return;
    }
    try {
      const tags = form.tags.split(',').map(t => t.trim()).filter(Boolean);
      await createMemory(dog.id, {
        title: form.title,
        note: form.note,
        tags,
        date: form.date ? new Date(form.date).getTime() : Date.now(),
        type: 'note',
      });
      setForm({ title: '', note: '', tags: '', date: '' });
      setCreating(false);
      showToast('Memory saved', 'success');
    } catch (err) {
      showToast(`Failed: ${err.message}`, 'error');
    }
  }, [dog, form]);

  const handleDelete = useCallback(async (memoryId) => {
    try {
      await deleteMemory(memoryId);
      setMemories(m => m.filter(x => x.id !== memoryId));
      setFiltered(m => m.filter(x => x.id !== memoryId));
      setSelected(null);
      showToast('Memory removed', 'success');
    } catch {
      showToast('Failed to remove', 'error');
    }
  }, []);

  const handleToggleStar = useCallback(async (memory) => {
    try {
      const updated = await updateMemory(memory.id, { starred: !memory.starred });
      setMemories(m => m.map(x => x.id === memory.id ? updated : x));
      setFiltered(m => m.map(x => x.id === memory.id ? updated : x));
    } catch {}
  }, []);

  if (!dog) return <div className={styles.empty}>No companion loaded.</div>;

  return (
    <div className={styles.container}>
      {/* HEADER */}
      <div className={styles.header}>
        <h1 className={styles.title}>Memories</h1>
        <button className={styles.createBtn} onClick={() => setCreating(c => !c)}>
          {creating ? '✕' : '+ New'}
        </button>
      </div>

      {/* CREATE FORM */}
      <AnimatePresence>
        {creating && (
          <motion.div className={styles.createForm}
            initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.25 }}
          >
            <div className={styles.formInner}>
              <input className={styles.input} placeholder="Title (optional)"
                value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
              <textarea className={styles.textarea} placeholder="What do you remember?"
                value={form.note} onChange={e => setForm(f => ({ ...f, note: e.target.value }))}
                rows={3} />
              <div className={styles.formRow}>
                <input className={styles.input} placeholder="Tags (comma separated)"
                  value={form.tags} onChange={e => setForm(f => ({ ...f, tags: e.target.value }))} />
                <input className={styles.input} type="date"
                  value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} />
              </div>
              <button className={styles.saveBtn} onClick={handleCreate}>Save Memory</button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* SEARCH */}
      <div className={styles.searchRow}>
        <input
          className={styles.searchInput}
          placeholder="Search memories…"
          value={searchQuery}
          onChange={e => handleSearch(e.target.value)}
        />
      </div>

      {/* LIST */}
      {loading ? (
        <div className={styles.loadingState}>Loading memories…</div>
      ) : filtered.length === 0 ? (
        <div className={styles.emptyState}>
          <span>💙</span>
          <p>{searchQuery ? 'No matching memories' : `Start capturing ${dog.name}'s moments`}</p>
        </div>
      ) : (
        <div className={styles.list}>
          {filtered.map(memory => (
            <MemoryCard
              key={memory.id}
              memory={memory}
              onClick={() => setSelected(memory)}
              onStar={() => handleToggleStar(memory)}
            />
          ))}
        </div>
      )}

      {/* MEMORY DETAIL */}
      <AnimatePresence>
        {selected && (
          <motion.div className={styles.detailOverlay}
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={() => setSelected(null)}
          >
            <motion.div className={styles.detailCard}
              initial={{ y: 40 }} animate={{ y: 0 }} exit={{ y: 40 }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              onClick={e => e.stopPropagation()}
            >
              <div className={styles.detailHeader}>
                <h2 className={styles.detailTitle}>{selected.title || 'Memory'}</h2>
                <button className={styles.closeBtn} onClick={() => setSelected(null)}>✕</button>
              </div>
              {selected.date && (
                <p className={styles.detailDate}>{new Date(selected.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
              )}
              {selected.note && <p className={styles.detailNote}>{selected.note}</p>}
              {selected.tags?.length > 0 && (
                <div className={styles.tagRow}>
                  {selected.tags.map(tag => <span key={tag} className={styles.tag}>{tag}</span>)}
                </div>
              )}
              <div className={styles.detailActions}>
                <button className={styles.detailBtn} onClick={() => handleToggleStar(selected)}>
                  {selected.starred ? '★ Starred' : '☆ Star'}
                </button>
                <button className={`${styles.detailBtn} ${styles.danger}`} onClick={() => handleDelete(selected.id)}>
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

function MemoryCard({ memory, onClick, onStar }) {
  const date = memory.date ? new Date(memory.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : null;
  return (
    <motion.div
      className={styles.card}
      onClick={onClick}
      whileTap={{ scale: 0.98 }}
    >
      <div className={styles.cardTop}>
        {memory.title && <h3 className={styles.cardTitle}>{memory.title}</h3>}
        <button className={`${styles.starBtn} ${memory.starred ? styles.starred : ''}`}
          onClick={e => { e.stopPropagation(); onStar(); }}>
          {memory.starred ? '★' : '☆'}
        </button>
      </div>
      {memory.note && <p className={styles.cardNote}>{memory.note}</p>}
      <div className={styles.cardBottom}>
        {date && <span className={styles.cardDate}>{date}</span>}
        {memory.tags?.length > 0 && (
          <div className={styles.cardTags}>
            {memory.tags.slice(0, 3).map(t => <span key={t} className={styles.tag}>{t}</span>)}
          </div>
        )}
      </div>
    </motion.div>
  );
}
