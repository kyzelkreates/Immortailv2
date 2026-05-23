// ================================================================
// IMMORTAIL™ — MY DOG ROUTE
// Dog profile management + media library.
// Upload, view, and manage all dog media.
// ================================================================

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { getState } from '@/core/storage.js';
import { eventBus } from '@/core/eventBus.js';
import { EVENT } from '@/core/constants.js';
import { updateDogProfile } from '@/systems/dogSystem/dogSystem.js';
import { ingestMultipleFiles, validateMediaFile, detectMediaType } from '@/systems/persistenceSystem/mediaIngest.js';
import { getMediaByDog, getMedia, deleteMedia } from '@/storage/indexedDb.js';
import { showToast } from '@/ui/feedback/Toast.jsx';
import styles from './MyDog.module.css';

export default function MyDog() {
  const [dog, setDog] = useState(getState().activeDog);
  const [mediaItems, setMediaItems] = useState([]);
  const [selectedMedia, setSelectedMedia] = useState(null);
  const [editMode, setEditMode] = useState(false);
  const [editProfile, setEditProfile] = useState({});
  const [uploading, setUploading] = useState(false);
  const blobUrls = useRef([]);

  useEffect(() => {
    const off = eventBus.on(EVENT.DOG_LOADED, ({ dog: d }) => { setDog(d); setEditProfile(d || {}); });
    return off;
  }, []);

  useEffect(() => {
    if (dog) {
      setEditProfile({ ...dog });
      loadMedia(dog.id);
    }
  }, [dog?.id]);

  // Cleanup blob URLs on unmount
  useEffect(() => {
    return () => { blobUrls.current.forEach(u => URL.revokeObjectURL(u)); };
  }, []);

  async function loadMedia(dogId) {
    try {
      const items = await getMediaByDog(dogId);
      const withUrls = await Promise.all(
        items.map(async item => {
          if (!item.thumbnailBlob && !item.blob) return { ...item, objectUrl: null };
          const blob = item.thumbnailBlob || item.blob;
          const url = URL.createObjectURL(blob);
          blobUrls.current.push(url);
          return { ...item, objectUrl: url };
        })
      );
      setMediaItems(withUrls.sort((a, b) => b.createdAt - a.createdAt));
    } catch (err) {
      console.error('[MyDog] loadMedia failed:', err);
    }
  }

  const handleFileUpload = useCallback(async (e) => {
    if (!dog) return;
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    setUploading(true);
    try {
      const results = await ingestMultipleFiles(files, dog.id, () => {});
      const failed = results.filter(r => !r.ok);
      if (failed.length) showToast(`${failed.length} file(s) failed to upload`, 'error');
      const success = results.filter(r => r.ok).length;
      if (success) { showToast(`${success} file(s) added`, 'success'); await loadMedia(dog.id); }
    } catch (err) {
      showToast(`Upload failed: ${err.message}`, 'error');
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  }, [dog]);

  const handleSetCover = useCallback(async (mediaId) => {
    if (!dog) return;
    try {
      await updateDogProfile(dog.id, { coverMediaId: mediaId });
      showToast('Cover photo updated', 'success');
    } catch (err) {
      showToast('Failed to update cover', 'error');
    }
  }, [dog]);

  const handleDeleteMedia = useCallback(async (mediaId) => {
    try {
      await deleteMedia(mediaId);
      setMediaItems(m => m.filter(item => item.id !== mediaId));
      if (selectedMedia?.id === mediaId) setSelectedMedia(null);
      showToast('Removed', 'success');
    } catch (err) {
      showToast('Failed to remove', 'error');
    }
  }, [selectedMedia]);

  const handleSaveProfile = useCallback(async () => {
    if (!dog) return;
    try {
      await updateDogProfile(dog.id, {
        name: editProfile.name,
        breed: editProfile.breed,
        birthDate: editProfile.birthDate,
        passedDate: editProfile.passedDate,
        bio: editProfile.bio,
      });
      showToast('Profile saved', 'success');
      setEditMode(false);
    } catch (err) {
      showToast(`Save failed: ${err.message}`, 'error');
    }
  }, [dog, editProfile]);

  const openMedia = useCallback(async (item) => {
    if (!item.blob && item.id) {
      const full = await getMedia(item.id);
      if (full?.blob) {
        const url = URL.createObjectURL(full.blob);
        blobUrls.current.push(url);
        setSelectedMedia({ ...full, objectUrl: url });
        return;
      }
    }
    setSelectedMedia(item);
  }, []);

  if (!dog) return <div className={styles.empty}>No companion loaded.</div>;

  return (
    <div className={styles.container}>
      {/* HEADER */}
      <div className={styles.header}>
        <div className={styles.headerInfo}>
          <h1 className={styles.dogName}>{dog.name}</h1>
          {dog.breed && <span className={styles.breed}>{dog.breed}</span>}
        </div>
        <button className={styles.editBtn} onClick={() => setEditMode(e => !e)}>
          {editMode ? 'Cancel' : 'Edit'}
        </button>
      </div>

      {/* EDIT PROFILE */}
      <AnimatePresence>
        {editMode && (
          <motion.div
            className={styles.editPanel}
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3 }}
          >
            <div className={styles.form}>
              {[
                { key: 'name', label: 'Name', placeholder: 'Dog name' },
                { key: 'breed', label: 'Breed', placeholder: 'Breed' },
                { key: 'bio', label: 'Bio', placeholder: 'Bio / personality', type: 'textarea' },
              ].map(({ key, label, placeholder, type }) => (
                <div key={key} className={styles.formField}>
                  <label className={styles.label}>{label}</label>
                  {type === 'textarea' ? (
                    <textarea className={styles.textarea} value={editProfile[key] || ''} placeholder={placeholder}
                      onChange={e => setEditProfile(p => ({ ...p, [key]: e.target.value }))} rows={2} />
                  ) : (
                    <input className={styles.input} value={editProfile[key] || ''} placeholder={placeholder}
                      onChange={e => setEditProfile(p => ({ ...p, [key]: e.target.value }))} />
                  )}
                </div>
              ))}
              <div className={styles.dateRow}>
                <div className={styles.formField}>
                  <label className={styles.label}>Born</label>
                  <input type="date" className={styles.input} value={editProfile.birthDate || ''}
                    onChange={e => setEditProfile(p => ({ ...p, birthDate: e.target.value }))} />
                </div>
                <div className={styles.formField}>
                  <label className={styles.label}>Passed</label>
                  <input type="date" className={styles.input} value={editProfile.passedDate || ''}
                    onChange={e => setEditProfile(p => ({ ...p, passedDate: e.target.value }))} />
                </div>
              </div>
              <button className={styles.saveBtn} onClick={handleSaveProfile}>Save Profile</button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* BIO */}
      {!editMode && dog.bio && (
        <p className={styles.bio}>{dog.bio}</p>
      )}

      {/* MEDIA UPLOAD */}
      <div className={styles.sectionHeader}>
        <span className={styles.sectionTitle}>Photos & Videos</span>
        <label className={`${styles.uploadBtn} ${uploading ? styles.uploading : ''}`}>
          <input type="file" multiple accept="image/*,video/*,audio/*" onChange={handleFileUpload}
            style={{ display: 'none' }} disabled={uploading} />
          {uploading ? 'Uploading…' : '+ Add'}
        </label>
      </div>

      {/* MEDIA GRID */}
      {mediaItems.length === 0 ? (
        <div className={styles.emptyMedia}>
          <span>📷</span>
          <p>No photos yet — add some memories</p>
        </div>
      ) : (
        <div className={styles.mediaGrid}>
          {mediaItems.map(item => (
            <div key={item.id} className={styles.mediaItem} onClick={() => openMedia(item)}>
              {item.type === 'image' && item.objectUrl && (
                <img src={item.objectUrl} alt={item.filename} className={styles.mediaThumbnail} />
              )}
              {item.type === 'video' && (
                <div className={styles.videoThumb}>
                  {item.objectUrl
                    ? <img src={item.objectUrl} alt={item.filename} className={styles.mediaThumbnail} />
                    : <span>🎬</span>}
                  <span className={styles.videoIcon}>▶</span>
                </div>
              )}
              {item.type === 'audio' && (
                <div className={styles.audioThumb}><span>🎵</span></div>
              )}
              {dog.coverMediaId === item.id && (
                <div className={styles.coverBadge}>Cover</div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* MEDIA LIGHTBOX */}
      <AnimatePresence>
        {selectedMedia && (
          <motion.div className={styles.lightbox}
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={() => setSelectedMedia(null)}
          >
            <motion.div className={styles.lightboxContent}
              initial={{ scale: 0.9 }} animate={{ scale: 1 }} exit={{ scale: 0.9 }}
              onClick={e => e.stopPropagation()}
            >
              {selectedMedia.type === 'image' && selectedMedia.objectUrl && (
                <img src={selectedMedia.objectUrl} alt={selectedMedia.filename} className={styles.lightboxImg} />
              )}
              {selectedMedia.type === 'video' && selectedMedia.objectUrl && (
                <video src={selectedMedia.objectUrl} controls className={styles.lightboxVideo} />
              )}
              {selectedMedia.type === 'audio' && selectedMedia.objectUrl && (
                <div className={styles.lightboxAudio}>
                  <span>🎵</span>
                  <audio src={selectedMedia.objectUrl} controls />
                </div>
              )}
              <p className={styles.lightboxName}>{selectedMedia.filename}</p>
              <div className={styles.lightboxActions}>
                <button className={styles.lightboxBtn} onClick={() => handleSetCover(selectedMedia.id)}>
                  Set as Cover
                </button>
                <button className={`${styles.lightboxBtn} ${styles.danger}`}
                  onClick={() => handleDeleteMedia(selectedMedia.id)}>
                  Remove
                </button>
                <button className={styles.lightboxBtn} onClick={() => setSelectedMedia(null)}>
                  Close
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
