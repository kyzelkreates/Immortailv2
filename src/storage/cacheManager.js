// ================================================================
// IMMORTAIL™ — CACHE MANAGER
// Controls service worker cache versioning and cleanup.
// ================================================================

export const CACHE_VERSION = 'immortail-v1';

export async function getCurrentCaches() {
  if (!('caches' in window)) return [];
  return caches.keys();
}

export async function deleteOldCaches() {
  if (!('caches' in window)) return;
  const keys = await caches.keys();
  await Promise.all(
    keys.filter(k => k !== CACHE_VERSION).map(k => caches.delete(k))
  );
}

export async function getCacheSize() {
  if (!('storage' in navigator && 'estimate' in navigator.storage)) return null;
  const estimate = await navigator.storage.estimate();
  return {
    used: estimate.usage,
    quota: estimate.quota,
    percentUsed: estimate.quota ? Math.round((estimate.usage / estimate.quota) * 100) : 0,
  };
}

export async function requestPersistentStorage() {
  if (!('storage' in navigator && 'persist' in navigator.storage)) return false;
  const persisted = await navigator.storage.persisted();
  if (persisted) return true;
  return navigator.storage.persist();
}
