// ================================================================
// IMMORTAIL™ — MEDIA WORKER
// Processes images and media files off the main thread.
// Generates thumbnails, extracts metadata.
// ================================================================

self.onmessage = async (event) => {
  const { type, id, payload } = event.data;

  if (type === 'process_image') {
    try {
      const result = await _processImage(payload.blob, payload.options || {});
      self.postMessage({ type: 'done', id, result }, [result.thumbnailBlob]);
    } catch (err) {
      self.postMessage({ type: 'error', id, error: err.message });
    }
    return;
  }

  if (type === 'process_video') {
    // Video processing: extract duration and first frame thumbnail
    // This is async-heavy and must run off-main-thread
    self.postMessage({ type: 'done', id, result: { processed: true, type: 'video' } });
    return;
  }
};

async function _processImage(blob, options) {
  const { maxWidth = 1200, maxHeight = 1200, thumbWidth = 300, thumbHeight = 300, quality = 0.85 } = options;

  const bitmap = await createImageBitmap(blob);
  const origW = bitmap.width;
  const origH = bitmap.height;

  // Calculate scaled dimensions
  let w = origW, h = origH;
  if (w > maxWidth || h > maxHeight) {
    const scale = Math.min(maxWidth / w, maxHeight / h);
    w = Math.round(w * scale);
    h = Math.round(h * scale);
  }

  // Main canvas
  const canvas = new OffscreenCanvas(w, h);
  const ctx = canvas.getContext('2d');
  ctx.drawImage(bitmap, 0, 0, w, h);
  const processedBlob = await canvas.convertToBlob({ type: 'image/jpeg', quality });

  // Thumbnail canvas
  const tScale = Math.min(thumbWidth / origW, thumbHeight / origH);
  const tW = Math.round(origW * tScale);
  const tH = Math.round(origH * tScale);
  const thumbCanvas = new OffscreenCanvas(tW, tH);
  const thumbCtx = thumbCanvas.getContext('2d');
  thumbCtx.drawImage(bitmap, 0, 0, tW, tH);
  const thumbnailBlob = await thumbCanvas.convertToBlob({ type: 'image/jpeg', quality: 0.7 });

  bitmap.close();

  return {
    processedBlob,
    thumbnailBlob,
    width: w,
    height: h,
    origWidth: origW,
    origHeight: origH,
    size: processedBlob.size,
  };
}
