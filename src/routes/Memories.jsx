// ================================================================
// IMMORTAIL™ — MEMORIES SANCTUARY
// Not a photo gallery. A sacred emotional archive.
// Soft. Reflective. Cinematic. Intimate.
// ================================================================

import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { loadMemoriesForDog as loadMemories, createMemory, deleteMemory, updateMemory } from '@/systems/memorySystem/memorySystem.js';
import { getState } from '@/core/storage.js';
import { showToast } from '@/ui/feedback/Toast.jsx';
import styles from './Memories.module.css';

const MEMORY_TYPES = [
  { id: 'moment',  label: 'Moment',  emoji: '✨' },
  { id: 'story',   label: 'Story',   emoji: '📖' },
  { id: 'feeling', label: 'Feeling', emoji: '💛' },
  { id: 'funny',   label: 'Funny',   emoji: '😄' },
  { id: 'first',   label: 'First',   emoji: '🌟' },
];

export default function Memories() {
  const [memories, setMemories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [selectedMemory, setSelectedMemory] = useState(null);
  const [form, setForm] = useState({ title: '', content: '', type: 'moment', date: '' });
  const [saving, setSaving] = useState(false);
  const [filter, setFilter] = useState('all');

  const dog = getState().activeDog;

  useEffect(() => {
    if (!dog) return;
    loadMemories(dog.id)
      .then(m => setMemories(m || []))
      .catch(() => setMemories([]))
      .finally(() => setLoading(false));
  }, [dog?.id]);

  const handleSave = useCallback(async () => {
    if (!form.title.trim() || !form.content.trim()) {
      showToast('Title and memory are required', 'error'); return;
    }
    setSaving(true);
    try {
      const saved = await createMemory(dog.id, form);
      setMemories(m => [saved, ...m]);
      setForm({ title: '', content: '', type: 'moment', date: '' });
      setCreating(false);
      showToast('Memory preserved ✦', 'success');
    } catch (err) { showToast(err.message, 'error'); }
    finally { setSaving(false); }
  }, [form, dog?.id]);

  const handleDelete = useCallback(async (id) => {
    try {
      await deleteMemory(id);
      setMemories(m => m.filter(mem => mem.id !== id));
      setSelectedMemory(null);
      showToast('Memory released', 'success');
    } catch (err) { showToast(err.message, 'error'); }
  }, []);

  const handleStar = useCallback(async (memory) => {
    try {
      const updated = await updateMemory(memory.id, { starred: !memory.starred });
      setMemories(m => m.map(mem => mem.id === memory.id ? { ...mem, starred: updated.starred } : mem));
      if (selectedMemory?.id === memory.id) setSelectedMemory(s => ({ ...s, starred: updated.starred }));
    } catch {}
  }, [selectedMemory]);

  const filtered = filter === 'starred'
    ? memories.filter(m => m.starred)
    : filter === 'all' ? memories : memories.filter(m => m.type === filter);

  return (
    <div className={styles.sanctuary}>

      {/* HEADER */}
      <motion.div className={styles.header}
        initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
        <div className={styles.headerLeft}>
          <h1 className={styles.title}>Memories</h1>
          {dog && <span className={styles.subtitle}>{dog.name}'s story, preserved forever</span>}
        </div>
        <motion.button
          className={styles.addBtn}
          onClick={() => setCreating(c => !c)}
          whileTap={{ scale: 0.9 }}
          animate={creating ? { rotate: 45 } : { rotate: 0 }}
          transition={{ duration: 0.3 }}
        >
          +
        </motion.button>
      </motion.div>

      {/* CREATE FORM */}
      <AnimatePresence>
        {creating && (
          <motion.div className={styles.createPanel}
            initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.4, ease: [0.16,1,0.3,1] }}>
            <div className={styles.createForm}>
              {/* Type selector */}
              <div className={styles.typeRow}>
                {MEMORY_TYPES.map(t => (
                  <button key={t.id}
                    className={`${styles.typeChip} ${form.type === t.id ? styles.typeChipActive : ''}`}
                    onClick={() => setForm(f => ({ ...f, type: t.id }))}>
                    {t.emoji} {t.label}
                  </button>
                ))}
              </div>

              <input className={styles.input} placeholder="A title for this memory…"
                value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />

              <textarea className={styles.textarea}
                placeholder="Write what you remember… how it felt, what they did, what made it special…"
                value={form.content} onChange={e => setForm(f => ({ ...f, content: e.target.value }))} rows={5} />

              <input className={styles.input} type="date" value={form.date}
                onChange={e => setForm(f => ({ ...f, date: e.target.value }))} />

              <div className={styles.formActions}>
                <button className={styles.btnSecondary} onClick={() => setCreating(false)}>Cancel</button>
                <motion.button className={styles.btnPrimary} onClick={handleSave}
                  disabled={saving} whileTap={{ scale: 0.95 }}>
                  {saving ? 'Preserving…' : 'Preserve memory'}
                </motion.button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* FILTER BAR */}
      {memories.length > 0 && (
        <motion.div className={styles.filterBar}
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}>
          {[
            { id: 'all', label: 'All' },
            { id: 'starred', label: '✦ Cherished' },
            ...MEMORY_TYPES.map(t => ({ id: t.type, label: t.emoji })),
          ].map(f => (
            <button key={f.id}
              className={`${styles.filterChip} ${filter === f.id ? styles.filterChipActive : ''}`}
              onClick={() => setFilter(f.id)}>
              {f.label}
            </button>
          ))}
        </motion.div>
      )}

      {/* MEMORY GRID */}
      {loading ? (
        <div className={styles.loadingState}>
          {[0,1,2].map(i => (
            <motion.div key={i} className={styles.loadingCard}
              animate={{ opacity: [0.3, 0.6, 0.3] }}
              transition={{ duration: 1.8, repeat: Infinity, delay: i * 0.3 }} />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <motion.div className={styles.emptyState}
          initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
          <span className={styles.emptyPaw}>🐾</span>
          <span className={styles.emptyTitle}>
            {memories.length === 0 ? 'No memories yet' : 'None in this collection'}
          </span>
          <span className={styles.emptyDesc}>
            {memories.length === 0
              ? `Every moment with ${dog?.name || 'them'} deserves to live on. Add your first memory.`
              : 'Try a different filter.'}
          </span>
        </motion.div>
      ) : (
        <motion.div className={styles.grid}
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}>
          {filtered.map((mem, i) => (
            <motion.div key={mem.id} className={styles.memoryCard}
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.06, duration: 0.5, ease: [0.16,1,0.3,1] }}
              onClick={() => setSelectedMemory(mem)}
              whileTap={{ scale: 0.97 }}
            >
              <div className={styles.cardAccent} />
              <div className={styles.cardHeader}>
                <span className={styles.cardType}>{MEMORY_TYPES.find(t => t.id === mem.type)?.emoji || '✨'}</span>
                {mem.starred && <span className={styles.cardStar}>✦</span>}
              </div>
              <h3 className={styles.cardTitle}>{mem.title}</h3>
              <p className={styles.cardPreview}>{mem.content}</p>
              {mem.date && <span className={styles.cardDate}>{mem.date}</span>}
            </motion.div>
          ))}
        </motion.div>
      )}

      {/* MEMORY DETAIL — cinematic bottom sheet */}
      <AnimatePresence>
        {selectedMemory && (
          <motion.div className={styles.backdrop}
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={() => setSelectedMemory(null)}>
            <motion.div className={styles.sheet}
              initial={{ y: '100%', opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: '100%', opacity: 0 }}
              transition={{ type: 'spring', stiffness: 260, damping: 32 }}
              onClick={e => e.stopPropagation()}>

              <div className={styles.sheetHandle} />
              <div className={styles.sheetAccent} />

              <div className={styles.sheetHeader}>
                <span className={styles.sheetType}>
                  {MEMORY_TYPES.find(t => t.id === selectedMemory.type)?.emoji || '✨'}
                  {' '}
                  {MEMORY_TYPES.find(t => t.id === selectedMemory.type)?.label}
                </span>
                {selectedMemory.date && <span className={styles.sheetDate}>{selectedMemory.date}</span>}
              </div>

              <h2 className={styles.sheetTitle}>{selectedMemory.title}</h2>
              <p className={styles.sheetContent}>{selectedMemory.content}</p>

              <div className={styles.sheetActions}>
                <motion.button
                  className={`${styles.sheetBtn} ${selectedMemory.starred ? styles.sheetBtnStarred : ''}`}
                  onClick={() => handleStar(selectedMemory)}
                  whileTap={{ scale: 0.9 }}>
                  {selectedMemory.starred ? '✦ Cherished' : '✦ Cherish'}
                </motion.button>
                <motion.button
                  className={`${styles.sheetBtn} ${styles.sheetBtnDanger}`}
                  onClick={() => handleDelete(selectedMemory.id)}
                  whileTap={{ scale: 0.9 }}>
                  Release
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
