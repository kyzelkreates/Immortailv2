// ================================================================
// IMMORTAIL™ — SETUP ROUTE
// First-run flow: Welcome → Profile → Photos → AI Setup → Done
// ================================================================

import React, { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { createDogProfile } from '@/systems/dogSystem/dogSystem.js';
import { ingestMultipleFiles, validateMediaFile, detectMediaType } from '@/systems/persistenceSystem/mediaIngest.js';
import { setSetupComplete, updateAiSettings } from '@/core/storage.js';
import { navigate } from '@/core/router.js';
import { ROUTES, AI_PROVIDER } from '@/core/constants.js';
import { showToast } from '@/ui/feedback/Toast.jsx';
import styles from './Setup.module.css';

const STEPS = ['welcome', 'profile', 'photos', 'ai', 'done'];

const AI_OPTIONS = [
  {
    id: AI_PROVIDER.OLLAMA,
    name: 'Ollama',
    badge: 'Local · Free · Private',
    badgeColor: 'gold',
    icon: '🖥️',
    tagline: 'Run AI models directly on your machine. No internet, no API key, fully private.',
    steps: [
      { label: 'Download Ollama', detail: 'Visit ollama.com and install for Mac, Windows, or Linux.' },
      { label: 'Start the server', detail: 'Run: ollama serve  (starts automatically on most systems)' },
      { label: 'Pull a model', detail: 'Run: ollama pull llama3  (or mistral, gemma2, phi3, qwen2...)' },
      { label: 'Enter URL below', detail: 'Default: http://localhost:11434' },
    ],
    models: ['llama3', 'llama3.1', 'mistral', 'gemma2', 'phi3', 'qwen2', 'deepseek-r1'],
    fields: [
      { key: 'ollamaUrl',   label: 'Ollama URL',  placeholder: 'http://localhost:11434', type: 'url' },
      { key: 'ollamaModel', label: 'Model name',  placeholder: 'llama3',                type: 'text' },
    ],
  },
  {
    id: AI_PROVIDER.OPENAI_COMPAT,
    name: 'OpenAI / API',
    badge: 'Cloud · API key required',
    badgeColor: 'silver',
    icon: '☁️',
    tagline: 'Use OpenAI, Groq, Together AI, Mistral AI, or any OpenAI-compatible endpoint.',
    steps: [
      { label: 'Choose a provider', detail: 'OpenAI: platform.openai.com  |  Groq: console.groq.com (free tier)  |  Mistral: console.mistral.ai' },
      { label: 'Get an API key', detail: 'Sign up → API keys → generate. Copy immediately — shown once.' },
      { label: 'Enter the base URL', detail: 'OpenAI: https://api.openai.com/v1\nGroq:   https://api.groq.com/openai/v1\nMistral: https://api.mistral.ai/v1' },
      { label: 'Choose a model', detail: 'GPT-4o, gpt-4o-mini, llama-3.1-70b-versatile (Groq), mistral-large-latest' },
    ],
    models: ['gpt-4o', 'gpt-4o-mini', 'llama-3.1-70b-versatile', 'mistral-large-latest', 'gemma2-9b-it'],
    fields: [
      { key: 'openaiCompatUrl',   label: 'Base URL', placeholder: 'https://api.openai.com/v1', type: 'url' },
      { key: 'openaiCompatKey',   label: 'API Key',  placeholder: 'sk-…',                       type: 'password' },
      { key: 'openaiCompatModel', label: 'Model',    placeholder: 'gpt-4o',                     type: 'text' },
    ],
  },
  {
    id: AI_PROVIDER.NONE,
    name: 'Skip for now',
    badge: 'Offline · No AI responses',
    badgeColor: 'muted',
    icon: '🔇',
    tagline: 'Use IMMORTAIL™ without AI. Enable it anytime from Settings.',
    steps: [],
    models: [],
    fields: [],
  },
];

export default function Setup() {
  const [step, setStep] = useState(0);
  const [profile, setProfile] = useState({ name: '', breed: '', birthDate: '', passedDate: '', bio: '' });
  const [files, setFiles] = useState([]);
  const [filePreviews, setFilePreviews] = useState([]);
  const [saving, setSaving] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState(null);
  const [aiFields, setAiFields] = useState({
    ollamaUrl: 'http://localhost:11434', ollamaModel: 'llama3',
    openaiCompatUrl: 'https://api.openai.com/v1', openaiCompatKey: '', openaiCompatModel: 'gpt-4o',
  });

  const nextStep = () => setStep(s => Math.min(s + 1, STEPS.length - 1));
  const prevStep = () => setStep(s => Math.max(s - 1, 0));
  const handleProfileChange = (field, value) => setProfile(p => ({ ...p, [field]: value }));

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

  const handleAiNext = useCallback(async () => {
    if (!selectedProvider) { showToast('Choose an AI option or skip', 'error'); return; }
    await updateAiSettings({ provider: selectedProvider, ...aiFields });
    nextStep();
  }, [selectedProvider, aiFields]);

  const handleComplete = useCallback(async () => {
    if (!profile.name.trim()) { showToast("Please enter your dog's name", 'error'); setStep(1); return; }
    setSaving(true);
    try {
      const dog = await createDogProfile(profile);
      if (files.length > 0) await ingestMultipleFiles(files, dog.id, () => {});
      await setSetupComplete(true);
      showToast('Welcome, ' + dog.name + ' 🐾', 'success');
      navigate(ROUTES.HOME, { force: true });
    } catch (err) {
      showToast('Setup failed: ' + err.message, 'error');
    } finally { setSaving(false); }
  }, [profile, files]);

  return (
    <div className={styles.container}>
      <div className={styles.stepIndicator}>
        {STEPS.map((s, i) => (
          <div key={s} className={`${styles.dot} ${i <= step ? styles.dotActive : ''}`} />
        ))}
      </div>
      <AnimatePresence mode="wait">
        <motion.div key={step} className={styles.stepContent}
          initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -30 }} transition={{ duration: 0.28 }}>
          {step === 0 && <WelcomeStep onNext={nextStep} />}
          {step === 1 && <ProfileStep profile={profile} onChange={handleProfileChange} onNext={nextStep} onBack={prevStep} />}
          {step === 2 && <PhotosStep files={files} previews={filePreviews} onSelect={handleFileSelect} onRemove={removeFile} onNext={nextStep} onBack={prevStep} />}
          {step === 3 && <AiStep selected={selectedProvider} onSelect={setSelectedProvider} fields={aiFields} onFieldChange={(k, v) => setAiFields(f => ({ ...f, [k]: v }))} onNext={handleAiNext} onBack={prevStep} />}
          {step === 4 && <DoneStep profile={profile} selectedProvider={selectedProvider} onComplete={handleComplete} onBack={prevStep} saving={saving} />}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

function WelcomeStep({ onNext }) {
  return (
    <div className={styles.stepInner}>
      <div className={styles.heroEmoji}>🐾</div>
      <h1 className={styles.heroTitle}>IMMORTAIL™</h1>
      <p className={styles.heroSub}>Your dog, forever.</p>
      <p className={styles.heroDesc}>Build a living digital presence from real photos, videos, and memories. They never truly leave.</p>
      <button className={styles.btnPrimary} onClick={onNext}>Begin</button>
    </div>
  );
}

function ProfileStep({ profile, onChange, onNext, onBack }) {
  const canContinue = profile.name.trim().length > 0;
  return (
    <div className={styles.stepInner}>
      <h2 className={styles.stepTitle}>Tell me about them</h2>
      <div className={styles.form}>
        <label className={styles.label}>Name *</label>
        <input className={styles.input} placeholder="Your dog's name" value={profile.name} onChange={e => onChange('name', e.target.value)} autoFocus />
        <label className={styles.label}>Breed</label>
        <input className={styles.input} placeholder="e.g. Golden Retriever" value={profile.breed} onChange={e => onChange('breed', e.target.value)} />
        <div className={styles.row}>
          <div className={styles.col}><label className={styles.label}>Born</label><input className={styles.input} type="date" value={profile.birthDate} onChange={e => onChange('birthDate', e.target.value)} /></div>
          <div className={styles.col}><label className={styles.label}>Passed</label><input className={styles.input} type="date" value={profile.passedDate} onChange={e => onChange('passedDate', e.target.value)} /></div>
        </div>
        <label className={styles.label}>Bio / personality</label>
        <textarea className={styles.textarea} placeholder="What made them special…" value={profile.bio} onChange={e => onChange('bio', e.target.value)} rows={3} />
      </div>
      <div className={styles.navBtns}>
        <button className={styles.btnSecondary} onClick={onBack}>Back</button>
        <button className={styles.btnPrimary} onClick={onNext} disabled={!canContinue}>Continue</button>
      </div>
    </div>
  );
}

function PhotosStep({ files, previews, onSelect, onRemove, onNext, onBack }) {
  return (
    <div className={styles.stepInner}>
      <h2 className={styles.stepTitle}>Add photos & videos</h2>
      <p className={styles.stepDesc}>Everything stays on your device — nothing is uploaded anywhere.</p>
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
        <button className={styles.btnPrimary} onClick={onNext}>{files.length > 0 ? `Continue with ${files.length} file${files.length !== 1 ? 's' : ''}` : 'Skip for now'}</button>
      </div>
    </div>
  );
}

function AiStep({ selected, onSelect, fields, onFieldChange, onNext, onBack }) {
  const [expanded, setExpanded] = useState(null);
  const handleSelect = (id) => { onSelect(id); setExpanded(id === AI_PROVIDER.NONE ? null : id); };
  return (
    <div className={styles.stepInner}>
      <h2 className={styles.stepTitle}>Choose your AI</h2>
      <p className={styles.stepDesc}>Powers responses from your dog. Optional — change anytime in Settings.</p>
      <div className={styles.aiCards}>
        {AI_OPTIONS.map(option => (
          <AiProviderCard key={option.id} option={option}
            isSelected={selected === option.id}
            isExpanded={expanded === option.id}
            fields={fields} onFieldChange={onFieldChange}
            onSelect={() => handleSelect(option.id)}
            onToggleExpand={() => setExpanded(e => e === option.id ? null : option.id)} />
        ))}
      </div>
      <div className={styles.navBtns}>
        <button className={styles.btnSecondary} onClick={onBack}>Back</button>
        <button className={styles.btnPrimary} onClick={onNext} disabled={!selected}>
          {selected === AI_PROVIDER.NONE ? 'Skip AI' : 'Save & Continue'}
        </button>
      </div>
    </div>
  );
}

function AiProviderCard({ option, isSelected, isExpanded, fields, onFieldChange, onSelect, onToggleExpand }) {
  return (
    <motion.div className={`${styles.aiCard} ${isSelected ? styles.aiCardSelected : ''}`} layout transition={{ duration: 0.25 }}>
      <div className={styles.aiCardHeader} onClick={onSelect}>
        <span className={styles.aiCardIcon}>{option.icon}</span>
        <div className={styles.aiCardInfo}>
          <span className={styles.aiCardName}>{option.name}</span>
          <span className={`${styles.aiCardBadge} ${styles['badge_' + option.badgeColor]}`}>{option.badge}</span>
        </div>
        <div className={`${styles.aiCardCheck} ${isSelected ? styles.aiCardCheckActive : ''}`}>{isSelected && '✦'}</div>
      </div>
      <p className={styles.aiCardTagline}>{option.tagline}</p>
      {option.steps.length > 0 && (
        <>
          <button className={styles.aiExpandBtn} onClick={onToggleExpand}>
            {isExpanded ? '▲ Hide setup guide' : '▼ View setup guide & configure'}
          </button>
          <AnimatePresence>
            {isExpanded && (
              <motion.div className={styles.aiExpanded}
                initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.25 }}>
                <div className={styles.aiSteps}>
                  {option.steps.map((s, i) => (
                    <div key={i} className={styles.aiStep}>
                      <div className={styles.aiStepNum}>{i + 1}</div>
                      <div className={styles.aiStepBody}>
                        <span className={styles.aiStepLabel}>{s.label}</span>
                        <span className={styles.aiStepDetail}>{s.detail}</span>
                      </div>
                    </div>
                  ))}
                </div>
                {option.models.length > 0 && (
                  <div className={styles.aiModels}>
                    <span className={styles.aiModelsLabel}>Popular models — tap to use</span>
                    <div className={styles.aiModelChips}>
                      {option.models.map(m => (
                        <button key={m} className={styles.aiModelChip}
                          onClick={() => onFieldChange(option.id === AI_PROVIDER.OLLAMA ? 'ollamaModel' : 'openaiCompatModel', m)}>
                          {m}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                {option.fields.length > 0 && (
                  <div className={styles.aiFields}>
                    {option.fields.map(f => (
                      <div key={f.key} className={styles.aiFieldRow}>
                        <label className={styles.label}>{f.label}</label>
                        <input className={styles.input} type={f.type} placeholder={f.placeholder}
                          value={fields[f.key] || ''} onChange={e => onFieldChange(f.key, e.target.value)} autoComplete="off" />
                      </div>
                    ))}
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </>
      )}
    </motion.div>
  );
}

function DoneStep({ profile, selectedProvider, onComplete, onBack, saving }) {
  const providerLabel = { ollama: 'Ollama (local AI)', openai_compat: 'OpenAI-compatible API', none: 'No AI (offline)', null: 'None' }[selectedProvider] || 'None';
  return (
    <div className={styles.stepInner}>
      <div className={styles.heroEmoji}>🐾</div>
      <h2 className={styles.stepTitle}>Ready to meet {profile.name || 'your companion'}?</h2>
      <div className={styles.summaryCard}>
        <div className={styles.summaryRow}><span className={styles.summaryLabel}>Dog</span><span className={styles.summaryValue}>{profile.name || '—'}</span></div>
        {profile.breed && <div className={styles.summaryRow}><span className={styles.summaryLabel}>Breed</span><span className={styles.summaryValue}>{profile.breed}</span></div>}
        <div className={styles.summaryRow}><span className={styles.summaryLabel}>AI</span><span className={styles.summaryValue}>{providerLabel}</span></div>
        <div className={styles.summaryRow}><span className={styles.summaryLabel}>Storage</span><span className={styles.summaryValue}>100% local · private</span></div>
      </div>
      <p className={styles.stepDesc}>No accounts. No servers. Everything lives on your device.</p>
      <div className={styles.navBtns}>
        <button className={styles.btnSecondary} onClick={onBack} disabled={saving}>Back</button>
        <button className={styles.btnPrimary} onClick={onComplete} disabled={saving}>
          {saving ? 'Creating…' : `Meet ${profile.name || 'them'} →`}
        </button>
      </div>
    </div>
  );
}
