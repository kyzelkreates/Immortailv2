// ================================================================
// IMMORTAIL™ — SETUP ROUTE
// First-run flow. Collects dog profile + uploads media.
// All async ops go through taskEngine.
// ================================================================

import React, { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { createDogProfile } from '@/systems/dogSystem/dogSystem.js';
import { ingestMultipleFiles, validateMediaFile, detectMediaType } from '@/systems/persistenceSystem/mediaIngest.js';
import { setSetupComplete } from '@/core/storage.js';
import { navigate } from '@/core/router.js';
import { ROUTES } from '@/core/constants.js';
import { showToast } from '@/ui/feedback/Toast.jsx';
import styles from './Setup.module.css';

const STEPS = ['welcome', 'profile', 'photos', 'done'];

export default function Setup() {
  const [step, setStep] = useState(0);
  const [profile, setProfile] = useState({
    name: '', breed: '', birthDate: '', passedDate: '', bio: '', personality: []
  });
  const [files, setFiles] = useState([]);
  const [filePreviews, setFilePreviews] = useState([]);
  const [saving, setSaving] = useState(false);

  const nextStep = () => setStep(s => Math.min(s + 1, STEPS.length - 1));
  const prevStep = () => setStep(s => Math.max(s - 1, 0));

  const handleProfileChange = (field, value) => {
    setProfile(p => ({ ...p, [field]: value }));
  };

  const handleFileSelect = useCallback((e) => {
    const selected = Array.from(e.target.files || []);
    const valid = selected.filter(f => {
      const errs = validateMediaFile(f);
      if (errs.length) { showToast(errs[0], 'error'); return false; }
      return true;
    });
    setFiles(prev => [...prev, ...valid]);
    valid.forEach(f => {
      const url = URL.createObjectURL(f);
      setFilePreviews(prev => [...prev, { url, type: detectMediaType(f), name: f.name }]);
    });
  }, []);

  const removeFile = (i) => {
    URL.revokeObjectURL(filePreviews[i]?.url);
    setFiles(f => f.filter((_, idx) => idx !== i));
    setFilePreviews(p => p.filter((_, idx) => idx !== i));
  };

  const handleComplete = useCallback(async () => {
    if (!profile.name.trim()) { showToast('Please enter your dog\'s name', 'error'); setStep(1); return; }
    setSaving(true);
    try {
      const dog = await createDogProfile(profile);
      if (files.length > 0) {
        await ingestMultipleFiles(files, dog.id, () => {});
      }
      await setSetupComplete(true);
      showToast(`Welcome, ${dog.name} 🐾`, 'success');
      navigate(ROUTES.HOME, { force: true });
    } catch (err) {
      showToast(`Setup failed: ${err.message}`, 'error');
    } finally {
      setSaving(false);
    }
  }, [profile, files]);

  return (
    <div className={styles.container}>
      <div className={styles.stepIndicator}>
        {STEPS.map((s, i) => (
          <div key={s} className={`${styles.dot} ${i <= step ? styles.dotActive : ''}`} />
        ))}
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={step}
          className={styles.stepContent}
          initial={{ opacity: 0, x: 30 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -30 }}
          transition={{ duration: 0.3 }}
        >
          {step === 0 && <WelcomeStep onNext={nextStep} />}
          {step === 1 && <ProfileStep profile={profile} onChange={handleProfileChange} onNext={nextStep} onBack={prevStep} />}
          {step === 2 && <PhotosStep files={files} previews={filePreviews} onSelect={handleFileSelect} onRemove={removeFile} onNext={nextStep} onBack={prevStep} />}
          {step === 3 && <DoneStep profile={profile} onComplete={handleComplete} onBack={prevStep} saving={saving} />}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

// ----------------------------------------------------------------
function WelcomeStep({ onNext }) {
  return (
    <div className={styles.stepInner}>
      <div className={styles.heroEmoji}>🐾</div>
      <h1 className={styles.heroTitle}>IMMORTAIL™</h1>
      <p className={styles.heroSub}>Your dog, forever.</p>
      <p className={styles.heroDesc}>
        Build a living digital presence of your dog — from real photos, videos, and memories. 
        They never truly leave.
      </p>
      <button className={styles.btnPrimary} onClick={onNext}>Begin</button>
    </div>
  );
}

// ----------------------------------------------------------------
function ProfileStep({ profile, onChange, onNext, onBack }) {
  const canContinue = profile.name.trim().length > 0;
  return (
    <div className={styles.stepInner}>
      <h2 className={styles.stepTitle}>Tell me about them</h2>
      <div className={styles.form}>
        <label className={styles.label}>Name *</label>
        <input className={styles.input} placeholder="Your dog's name" value={profile.name}
          onChange={e => onChange('name', e.target.value)} autoFocus />

        <label className={styles.label}>Breed</label>
        <input className={styles.input} placeholder="e.g. Golden Retriever" value={profile.breed}
          onChange={e => onChange('breed', e.target.value)} />

        <div className={styles.row}>
          <div className={styles.col}>
            <label className={styles.label}>Born</label>
            <input className={styles.input} type="date" value={profile.birthDate}
              onChange={e => onChange('birthDate', e.target.value)} />
          </div>
          <div className={styles.col}>
            <label className={styles.label}>Passed</label>
            <input className={styles.input} type="date" value={profile.passedDate}
              onChange={e => onChange('passedDate', e.target.value)} />
          </div>
        </div>

        <label className={styles.label}>Bio / personality</label>
        <textarea className={styles.textarea} placeholder="What made them special…" value={profile.bio}
          onChange={e => onChange('bio', e.target.value)} rows={3} />
      </div>

      <div className={styles.navBtns}>
        <button className={styles.btnSecondary} onClick={onBack}>Back</button>
        <button className={styles.btnPrimary} onClick={onNext} disabled={!canContinue}>Continue</button>
      </div>
    </div>
  );
}

// ----------------------------------------------------------------
function PhotosStep({ files, previews, onSelect, onRemove, onNext, onBack }) {
  return (
    <div className={styles.stepInner}>
      <h2 className={styles.stepTitle}>Add their photos & videos</h2>
      <p className={styles.stepDesc}>Upload images, videos, or audio. Everything is stored locally on your device.</p>

      <label className={styles.uploadZone}>
        <input type="file" multiple accept="image/*,video/*,audio/*" onChange={onSelect} style={{ display: 'none' }} />
        <span className={styles.uploadIcon}>📁</span>
        <span className={styles.uploadText}>Tap to select files</span>
        <span className={styles.uploadSub}>Photos, videos, audio · up to 100MB each</span>
      </label>

      {previews.length > 0 && (
        <div className={styles.previewGrid}>
          {previews.map((p, i) => (
            <div key={i} className={styles.previewItem}>
              {p.type === 'image' && <img src={p.url} alt={p.name} className={styles.previewImg} />}
              {p.type === 'video' && <video src={p.url} className={styles.previewImg} muted />}
              {p.type === 'audio' && <div className={styles.previewAudio}>🎵</div>}
              <button className={styles.removeBtn} onClick={() => onRemove(i)}>✕</button>
            </div>
          ))}
        </div>
      )}

      <div className={styles.navBtns}>
        <button className={styles.btnSecondary} onClick={onBack}>Back</button>
        <button className={styles.btnPrimary} onClick={onNext}>
          {files.length > 0 ? `Continue with ${files.length} file${files.length > 1 ? 's' : ''}` : 'Skip for now'}
        </button>
      </div>
    </div>
  );
}

// ----------------------------------------------------------------
function DoneStep({ profile, onComplete, onBack, saving }) {
  return (
    <div className={styles.stepInner}>
      <div className={styles.heroEmoji}>🐾</div>
      <h2 className={styles.stepTitle}>Ready to meet {profile.name || 'your companion'}?</h2>
      <p className={styles.stepDesc}>
        Everything will be stored privately on your device. No accounts. No servers. Just you and them.
      </p>

      <div className={styles.navBtns}>
        <button className={styles.btnSecondary} onClick={onBack} disabled={saving}>Back</button>
        <button className={styles.btnPrimary} onClick={onComplete} disabled={saving}>
          {saving ? 'Creating…' : `Meet ${profile.name || 'them'} →`}
        </button>
      </div>
    </div>
  );
}
