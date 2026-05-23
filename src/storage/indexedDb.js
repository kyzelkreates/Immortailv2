// ================================================================
// IMMORTAIL™ — INDEXEDDB LAYER
// All persistent storage runs through this module.
// Uses idb for Promise-based access.
// ================================================================

import { openDB } from 'idb';
import { DB_NAME, DB_VERSION, STORE } from '@/core/constants.js';

let _db = null;

async function getDb() {
  if (_db) return _db;
  _db = await openDB(DB_NAME, DB_VERSION, {
    upgrade(db, oldVersion) {
      // Create all object stores fresh (clean-room build)
      if (!db.objectStoreNames.contains(STORE.APP_STATE)) {
        db.createObjectStore(STORE.APP_STATE, { keyPath: 'key' });
      }
      if (!db.objectStoreNames.contains(STORE.DOG_PROFILES)) {
        const dogStore = db.createObjectStore(STORE.DOG_PROFILES, { keyPath: 'id', autoIncrement: true });
        dogStore.createIndex('name', 'name', { unique: false });
        dogStore.createIndex('createdAt', 'createdAt', { unique: false });
      }
      if (!db.objectStoreNames.contains(STORE.MEMORIES)) {
        const memStore = db.createObjectStore(STORE.MEMORIES, { keyPath: 'id', autoIncrement: true });
        memStore.createIndex('dogId', 'dogId', { unique: false });
        memStore.createIndex('type', 'type', { unique: false });
        memStore.createIndex('createdAt', 'createdAt', { unique: false });
        memStore.createIndex('tags', 'tags', { unique: false, multiEntry: true });
      }
      if (!db.objectStoreNames.contains(STORE.MEDIA)) {
        const mediaStore = db.createObjectStore(STORE.MEDIA, { keyPath: 'id', autoIncrement: true });
        mediaStore.createIndex('dogId', 'dogId', { unique: false });
        mediaStore.createIndex('type', 'type', { unique: false });
        mediaStore.createIndex('createdAt', 'createdAt', { unique: false });
      }
      if (!db.objectStoreNames.contains(STORE.AI_SETTINGS)) {
        db.createObjectStore(STORE.AI_SETTINGS, { keyPath: 'key' });
      }
      if (!db.objectStoreNames.contains(STORE.SETTINGS)) {
        db.createObjectStore(STORE.SETTINGS, { keyPath: 'key' });
      }
      if (!db.objectStoreNames.contains(STORE.EMOTION_LOG)) {
        const emoStore = db.createObjectStore(STORE.EMOTION_LOG, { keyPath: 'id', autoIncrement: true });
        emoStore.createIndex('dogId', 'dogId', { unique: false });
        emoStore.createIndex('ts', 'ts', { unique: false });
      }
    },
    blocked() {
      console.warn('[IDB] Database upgrade blocked by open tab.');
    },
    blocking() {
      _db?.close();
      _db = null;
    },
    terminated() {
      _db = null;
    }
  });
  return _db;
}

// ----------------------------------------------------------------
// GENERIC CRUD
// ----------------------------------------------------------------

export async function dbGet(storeName, key) {
  const db = await getDb();
  return db.get(storeName, key);
}

export async function dbPut(storeName, value) {
  const db = await getDb();
  return db.put(storeName, value);
}

export async function dbDelete(storeName, key) {
  const db = await getDb();
  return db.delete(storeName, key);
}

export async function dbGetAll(storeName) {
  const db = await getDb();
  return db.getAll(storeName);
}

export async function dbGetAllByIndex(storeName, indexName, query) {
  const db = await getDb();
  return db.getAllFromIndex(storeName, indexName, query);
}

export async function dbClear(storeName) {
  const db = await getDb();
  return db.clear(storeName);
}

export async function dbCount(storeName) {
  const db = await getDb();
  return db.count(storeName);
}

// ----------------------------------------------------------------
// APP STATE (key/value pairs)
// ----------------------------------------------------------------

export async function getAppState(key) {
  const record = await dbGet(STORE.APP_STATE, key);
  return record ? record.value : undefined;
}

export async function setAppState(key, value) {
  return dbPut(STORE.APP_STATE, { key, value, updatedAt: Date.now() });
}

// ----------------------------------------------------------------
// SETTINGS (key/value pairs)
// ----------------------------------------------------------------

export async function getSetting(key) {
  const record = await dbGet(STORE.SETTINGS, key);
  return record ? record.value : undefined;
}

export async function setSetting(key, value) {
  return dbPut(STORE.SETTINGS, { key, value, updatedAt: Date.now() });
}

export async function getAllSettings() {
  const all = await dbGetAll(STORE.SETTINGS);
  return all.reduce((acc, r) => { acc[r.key] = r.value; return acc; }, {});
}

// ----------------------------------------------------------------
// AI SETTINGS (key/value pairs)
// ----------------------------------------------------------------

export async function getAiSetting(key) {
  const record = await dbGet(STORE.AI_SETTINGS, key);
  return record ? record.value : undefined;
}

export async function setAiSetting(key, value) {
  return dbPut(STORE.AI_SETTINGS, { key, value, updatedAt: Date.now() });
}

export async function getAllAiSettings() {
  const all = await dbGetAll(STORE.AI_SETTINGS);
  return all.reduce((acc, r) => { acc[r.key] = r.value; return acc; }, {});
}

// ----------------------------------------------------------------
// MEDIA STORAGE — stores blobs directly in IndexedDB
// ----------------------------------------------------------------

export async function saveMedia(mediaRecord) {
  // mediaRecord: { dogId, type, blob, filename, mimeType, duration, width, height, size, tags, createdAt }
  const db = await getDb();
  return db.add(STORE.MEDIA, { ...mediaRecord, createdAt: mediaRecord.createdAt || Date.now() });
}

export async function getMedia(id) {
  return dbGet(STORE.MEDIA, id);
}

export async function getMediaByDog(dogId) {
  return dbGetAllByIndex(STORE.MEDIA, 'dogId', dogId);
}

export async function deleteMedia(id) {
  return dbDelete(STORE.MEDIA, id);
}

export async function updateMedia(id, updates) {
  const db = await getDb();
  const existing = await db.get(STORE.MEDIA, id);
  if (!existing) throw new Error(`Media ${id} not found`);
  return db.put(STORE.MEDIA, { ...existing, ...updates, updatedAt: Date.now() });
}

// ----------------------------------------------------------------
// HEALTH CHECK
// ----------------------------------------------------------------

export async function dbHealthCheck() {
  try {
    const db = await getDb();
    const storeNames = Array.from(db.objectStoreNames);
    const expected = Object.values(STORE);
    const missing = expected.filter(s => !storeNames.includes(s));
    return { ok: missing.length === 0, missing, storeNames };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}
