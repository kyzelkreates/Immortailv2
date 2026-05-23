// ================================================================
// IMMORTAIL™ — MEMORY SYSTEM
// All memory CRUD and indexing ops.
// Memories = timestamped notes, media references, tagged moments.
// ================================================================

import { queue } from '@/core/taskEngine.js';
import { TASK_TYPE, STORE, MEDIA_TYPE } from '@/core/constants.js';
import { eventBus } from '@/core/eventBus.js';
import { EVENT } from '@/core/constants.js';
import { dbPut, dbGet, dbDelete, dbGetAll, dbGetAllByIndex } from '@/storage/indexedDb.js';
import { saveMedia, getMediaByDog } from '@/storage/indexedDb.js';

let _memoryWorker = null;

export function initMemorySystem() {
  try {
    _memoryWorker = new Worker(new URL('@/workers/memory.worker.js', import.meta.url), { type: 'module' });
  } catch {
    _memoryWorker = null;
  }
}

// ----------------------------------------------------------------
// CREATE MEMORY
// ----------------------------------------------------------------
export async function createMemory(dogId, memoryData) {
  return queue(
    TASK_TYPE.MEMORY_SAVE,
    'Saving memory…',
    async ({ progress }) => {
      progress(20);
      const memory = {
        dogId,
        type: memoryData.type || 'note',        // note | photo | video | audio | moment
        title: memoryData.title || '',
        note: memoryData.note || '',
        caption: memoryData.caption || '',
        tags: memoryData.tags || [],
        mediaIds: memoryData.mediaIds || [],
        date: memoryData.date || Date.now(),
        emotion: memoryData.emotion || null,
        starred: memoryData.starred || false,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      progress(60);
      const id = await dbPut(STORE.MEMORIES, memory);
      const saved = { ...memory, id };
      _indexMemory(saved);
      progress(100);
      eventBus.emit(EVENT.MEMORY_SAVED, { memory: saved });
      return saved;
    }
  );
}

// ----------------------------------------------------------------
// LOAD MEMORIES FOR DOG
// ----------------------------------------------------------------
export async function loadMemoriesForDog(dogId) {
  return queue(
    TASK_TYPE.MEMORY_LOAD,
    'Loading memories…',
    async ({ progress }) => {
      progress(20);
      const memories = await dbGetAllByIndex(STORE.MEMORIES, 'dogId', dogId);
      memories.sort((a, b) => b.date - a.date);
      progress(70);
      _indexAll(memories);
      progress(100);
      eventBus.emit(EVENT.MEMORY_LOADED, { memories, dogId });
      return memories;
    },
    { showLoading: true, singleton: true }
  );
}

// ----------------------------------------------------------------
// GET SINGLE MEMORY
// ----------------------------------------------------------------
export async function getMemory(memoryId) {
  return dbGet(STORE.MEMORIES, memoryId);
}

// ----------------------------------------------------------------
// UPDATE MEMORY
// ----------------------------------------------------------------
export async function updateMemory(memoryId, updates) {
  return queue(
    TASK_TYPE.MEMORY_SAVE,
    'Updating memory…',
    async ({ progress }) => {
      progress(20);
      const existing = await dbGet(STORE.MEMORIES, memoryId);
      if (!existing) throw new Error('Memory not found');
      const updated = { ...existing, ...updates, updatedAt: Date.now() };
      progress(60);
      await dbPut(STORE.MEMORIES, updated);
      _indexMemory(updated);
      progress(100);
      return updated;
    }
  );
}

// ----------------------------------------------------------------
// DELETE MEMORY
// ----------------------------------------------------------------
export async function deleteMemory(memoryId) {
  return queue(
    TASK_TYPE.MEMORY_SAVE,
    'Removing memory…',
    async ({ progress }) => {
      progress(20);
      const memory = await dbGet(STORE.MEMORIES, memoryId);
      progress(50);
      await dbDelete(STORE.MEMORIES, memoryId);
      // Delete linked media too
      if (memory?.mediaIds?.length) {
        for (const mid of memory.mediaIds) {
          await dbDelete(STORE.MEDIA, mid).catch(() => {});
        }
      }
      progress(100);
      return { deleted: true, memoryId };
    }
  );
}

// ----------------------------------------------------------------
// SEARCH (via worker)
// ----------------------------------------------------------------
export function searchMemories(query, limit = 20) {
  return new Promise((resolve) => {
    if (!_memoryWorker) {
      resolve([]);
      return;
    }
    const id = Date.now();
    const handler = (e) => {
      if (e.data.type === 'results' && e.data.id === id) {
        _memoryWorker.removeEventListener('message', handler);
        resolve(e.data.results);
      }
    };
    _memoryWorker.addEventListener('message', handler);
    _memoryWorker.postMessage({ type: 'search', id, payload: { query, limit } });
    setTimeout(() => { _memoryWorker.removeEventListener('message', handler); resolve([]); }, 5000);
  });
}

// ----------------------------------------------------------------
// INTERNAL INDEX
// ----------------------------------------------------------------
function _indexAll(memories) {
  if (!_memoryWorker) return;
  _memoryWorker.postMessage({ type: 'index', payload: { memories } });
}

function _indexMemory(memory) {
  // Re-index is triggered by loadMemoriesForDog on next load
  // Individual memory adds don't need real-time worker indexing
}
