// ================================================================
// IMMORTAIL™ — MEDIA INGEST SYSTEM
// Processes and stores uploaded dog media (images, video, audio).
// Routes all heavy work through media.worker.js.
// ================================================================

import { queue } from '@/core/taskEngine.js';
import { TASK_TYPE, MEDIA_TYPE, ACCEPTED_IMAGE_TYPES, ACCEPTED_VIDEO_TYPES, ACCEPTED_AUDIO_TYPES, MAX_MEDIA_SIZE_BYTES } from '@/core/constants.js';
import { saveMedia, getMediaByDog } from '@/storage/indexedDb.js';
import { eventBus } from '@/core/eventBus.js';
import { EVENT } from '@/core/constants.js';

let _mediaWorker = null;

export function initMediaIngest() {
  try {
    _mediaWorker = new Worker(new URL('@/workers/media.worker.js', import.meta.url), { type: 'module' });
  } catch {
    _mediaWorker = null;
    console.warn('[MediaIngest] Media worker unavailable, processing on main thread.');
  }
}

// ----------------------------------------------------------------
// VALIDATE FILE
// ----------------------------------------------------------------
export function validateMediaFile(file) {
  const errors = [];
  if (file.size > MAX_MEDIA_SIZE_BYTES) {
    errors.push(`File too large (max 100MB): ${(file.size / (1024 * 1024)).toFixed(1)}MB`);
  }
  const allAccepted = [...ACCEPTED_IMAGE_TYPES, ...ACCEPTED_VIDEO_TYPES, ...ACCEPTED_AUDIO_TYPES];
  if (!allAccepted.includes(file.type)) {
    errors.push(`Unsupported file type: ${file.type}`);
  }
  return errors;
}

// ----------------------------------------------------------------
// DETECT MEDIA TYPE
// ----------------------------------------------------------------
export function detectMediaType(file) {
  if (ACCEPTED_IMAGE_TYPES.includes(file.type)) return MEDIA_TYPE.IMAGE;
  if (ACCEPTED_VIDEO_TYPES.includes(file.type)) return MEDIA_TYPE.VIDEO;
  if (ACCEPTED_AUDIO_TYPES.includes(file.type)) return MEDIA_TYPE.AUDIO;
  return null;
}

// ----------------------------------------------------------------
// INGEST FILE
// ----------------------------------------------------------------
export async function ingestMediaFile(file, dogId, metadata = {}) {
  return queue(
    TASK_TYPE.MEDIA_INGEST,
    `Processing ${file.name}…`,
    async ({ progress, cancel }) => {
      progress(5);
      const errors = validateMediaFile(file);
      if (errors.length) throw new Error(errors[0]);

      const mediaType = detectMediaType(file);
      if (!mediaType) throw new Error('Unknown media type');

      progress(15);
      cancel.throw();

      let processedBlob = file;
      let thumbnailBlob = null;
      let width = null, height = null;

      if (mediaType === MEDIA_TYPE.IMAGE) {
        progress(25);
        const result = await _processImage(file);
        processedBlob = result.processedBlob;
        thumbnailBlob = result.thumbnailBlob;
        width = result.width;
        height = result.height;
      }

      progress(70);
      cancel.throw();

      // Store blob directly in IndexedDB
      const mediaRecord = {
        dogId,
        type: mediaType,
        blob: processedBlob,
        thumbnailBlob: thumbnailBlob || null,
        filename: file.name,
        mimeType: mediaType === MEDIA_TYPE.IMAGE ? 'image/jpeg' : file.type,
        width,
        height,
        size: processedBlob.size,
        duration: metadata.duration || null,
        tags: metadata.tags || [],
        caption: metadata.caption || '',
        createdAt: Date.now(),
      };

      progress(85);
      const id = await saveMedia(mediaRecord);
      progress(100);

      const saved = { ...mediaRecord, id, blob: undefined }; // don't emit the blob
      eventBus.emit(EVENT.MEDIA_INGESTED, { id, type: mediaType, dogId });
      return { id, type: mediaType, dogId, filename: file.name, size: processedBlob.size, width, height };
    },
    { showLoading: true, cancellable: true, timeout: 60000 }
  );
}

// ----------------------------------------------------------------
// INGEST MULTIPLE FILES
// ----------------------------------------------------------------
export async function ingestMultipleFiles(files, dogId, onProgress) {
  const results = [];
  for (let i = 0; i < files.length; i++) {
    try {
      const result = await ingestMediaFile(files[i], dogId);
      results.push({ ok: true, result });
    } catch (err) {
      results.push({ ok: false, error: err.message, filename: files[i].name });
    }
    if (onProgress) onProgress(Math.round(((i + 1) / files.length) * 100), i + 1, files.length);
  }
  return results;
}

// ----------------------------------------------------------------
// GET BLOB URL (for rendering)
// Returns a revokable object URL from the stored blob.
// Caller must call URL.revokeObjectURL when done.
// ----------------------------------------------------------------
export function blobToObjectUrl(blob) {
  return URL.createObjectURL(blob);
}

// ----------------------------------------------------------------
// PROCESS IMAGE
// ----------------------------------------------------------------
function _processImage(file) {
  if (_mediaWorker) {
    return new Promise((resolve, reject) => {
      const id = Date.now();
      const handler = (e) => {
        if (e.data.id !== id) return;
        _mediaWorker.removeEventListener('message', handler);
        if (e.data.type === 'done') resolve(e.data.result);
        else reject(new Error(e.data.error));
      };
      _mediaWorker.addEventListener('message', handler);
      _mediaWorker.postMessage({ type: 'process_image', id, payload: { blob: file, options: {} } }, []);
      setTimeout(() => { _mediaWorker.removeEventListener('message', handler); reject(new Error('Image processing timeout')); }, 30000);
    });
  }

  // Fallback: no worker, return as-is
  return Promise.resolve({ processedBlob: file, thumbnailBlob: null, width: null, height: null });
}
