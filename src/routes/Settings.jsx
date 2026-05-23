// ================================================================
// IMMORTAIL™ — SETTINGS ROUTE
// Metallic gold/silver. AI config + app preferences.
// ================================================================

import React, { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { getState, updateSettings, updateAiSettings } from '@/core/storage.js';
import { setupAiProvider } from '@/core/aiEngine.js';
import { AI_PROVIDER } from '@/core/constants.js';
import { requestNotificationPermission } from '@/systems/notificationSystem/notificationSystem.js';
import { getCacheSize, requestPersistentStorage } from '@/storage/cacheManager.js';
import { showToast } from '@/ui/feedback/Toast.jsx';
import styles from './Settings.module.css';

export default function Settings() {
  const [settings, setSettingsLocal] = useState(getState().settings);
  const [aiSettings, setAiSettingsLocal] = useState(getState().aiSettings);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [storageInfo, setStorageInfo] = useState(null);

  const handleSettingChange = useCallback(async (key, value) => {
    setSettingsLocal(s => ({ ...s, [key]: value }));
    await updateSettings({ [key]: value });
  }, []);

  const handleAiChange = useCallback((key, value) => {
    setAiSettingsLocal(s => ({ ...s, [key]: value }));
  }, []);

  const saveAiSettings = useCallback(async () => {
    try {
      await updateAiSettings(aiSettings);
      showToast('AI settings saved ✦', 'success');
    } catch (err) { showToast(`Save failed: ${err.message}`, 'error'); }
  }, [aiSettings]);

  const testConnection = useCallback(async () => {
    setTesting(true); setTestResult(null);
    try {
      await updateAiSettings(aiSettings);
      const result = await setupAiProvider();
      setTestResult(result.ready
        ? { ok: true, msg: 'Connection successful' }
        : { ok: false, msg: 'Could not connect — check URL/model' });
    } catch (err) {
      setTestResult({ ok: false, msg: err.message });
    } finally { setTesting(false); }
  }, [aiSettings]);

  const requestNotifications = useCallback(async () => {
    const granted = await requestNotificationPermission();
    if (granted) { showToast('Notifications enabled', 'success'); handleSettingChange('notificationsEnabled', true); }
    else showToast('Permission denied', 'error');
  }, [handleSettingChange]);

  const checkStorage = useCallback(async () => {
    const info = await getCacheSize();
    setStorageInfo(info);
    await requestPersistentStorage();
  }, []);

  return (
    <div className={styles.container}>
      <motion.h1 className={styles.title} initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}>
        Settings
      </motion.h1>

      {/* ── AI PROVIDER ── */}
      <Section title="AI Provider" icon="🤖">
        <FieldRow label="Provider">
          <select className={styles.select} value={aiSettings.provider}
            onChange={e => handleAiChange('provider', e.target.value)}>
            <option value={AI_PROVIDER.NONE}>None (offline only)</option>
            <option value={AI_PROVIDER.OLLAMA}>Ollama (local AI)</option>
            <option value={AI_PROVIDER.OPENAI_COMPAT}>OpenAI-compatible API</option>
            <option value={AI_PROVIDER.CUSTOM}>Custom endpoint</option>
          </select>
        </FieldRow>

        <AnimatePresence mode="wait">
          {aiSettings.provider === AI_PROVIDER.OLLAMA && (
            <motion.div key="ollama" className={styles.providerBlock}
              initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
              <FieldRow label="Ollama URL">
                <input className={styles.input} placeholder="http://localhost:11434"
                  value={aiSettings.ollamaUrl} onChange={e => handleAiChange('ollamaUrl', e.target.value)} />
              </FieldRow>
              <FieldRow label="Model">
                <input className={styles.input} placeholder="llama3, mistral, gemma…"
                  value={aiSettings.ollamaModel} onChange={e => handleAiChange('ollamaModel', e.target.value)} />
              </FieldRow>
              <p className={styles.hint}>Run: <code>ollama serve</code> + <code>ollama pull llama3</code></p>
            </motion.div>
          )}

          {aiSettings.provider === AI_PROVIDER.OPENAI_COMPAT && (
            <motion.div key="openai" className={styles.providerBlock}
              initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
              <FieldRow label="Base URL">
                <input className={styles.input} placeholder="https://api.openai.com/v1"
                  value={aiSettings.openaiCompatUrl} onChange={e => handleAiChange('openaiCompatUrl', e.target.value)} />
              </FieldRow>
              <FieldRow label="API Key">
                <input className={styles.input} type="password" placeholder="sk-…"
                  value={aiSettings.openaiCompatKey} onChange={e => handleAiChange('openaiCompatKey', e.target.value)} />
              </FieldRow>
              <FieldRow label="Model">
                <input className={styles.input} placeholder="gpt-4o, claude-3-haiku…"
                  value={aiSettings.openaiCompatModel} onChange={e => handleAiChange('openaiCompatModel', e.target.value)} />
              </FieldRow>
            </motion.div>
          )}

          {aiSettings.provider === AI_PROVIDER.CUSTOM && (
            <motion.div key="custom" className={styles.providerBlock}
              initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
              <FieldRow label="Endpoint URL">
                <input className={styles.input} placeholder="https://your-api.example.com/chat"
                  value={aiSettings.customUrl} onChange={e => handleAiChange('customUrl', e.target.value)} />
              </FieldRow>
              <FieldRow label="Model">
                <input className={styles.input} placeholder="model name"
                  value={aiSettings.customModel} onChange={e => handleAiChange('customModel', e.target.value)} />
              </FieldRow>
              <FieldRow label="Headers (JSON)">
                <textarea className={styles.textarea}
                  placeholder='{"Authorization": "Bearer token"}'
                  value={aiSettings.customHeaders}
                  onChange={e => handleAiChange('customHeaders', e.target.value)} rows={2} />
              </FieldRow>
            </motion.div>
          )}
        </AnimatePresence>

        {aiSettings.provider !== AI_PROVIDER.NONE && (
          <>
            <FieldRow label="System prompt">
              <textarea className={styles.textarea}
                placeholder="You are a warm, emotionally intelligent presence for my dog…"
                value={aiSettings.systemPrompt}
                onChange={e => handleAiChange('systemPrompt', e.target.value)} rows={3} />
            </FieldRow>
            <FieldRow label={`Temperature — ${aiSettings.temperature}`}>
              <input type="range" min="0" max="1" step="0.05" className={styles.range}
                value={aiSettings.temperature}
                onChange={e => handleAiChange('temperature', parseFloat(e.target.value))} />
            </FieldRow>
            <FieldRow label="Max tokens">
              <input className={styles.input} type="number" min="50" max="2000"
                value={aiSettings.maxTokens}
                onChange={e => handleAiChange('maxTokens', parseInt(e.target.value))} />
            </FieldRow>
          </>
        )}

        <div className={styles.actionRow}>
          <button className={styles.btnSecondary} onClick={saveAiSettings}>Save</button>
          {aiSettings.provider !== AI_PROVIDER.NONE && (
            <button className={styles.btnPrimary} onClick={testConnection} disabled={testing}>
              {testing ? 'Testing…' : 'Test Connection'}
            </button>
          )}
        </div>

        {testResult && (
          <motion.div
            className={`${styles.testResult} ${testResult.ok ? styles.testOk : styles.testFail}`}
            initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
          >
            {testResult.ok ? '✦' : '✗'} {testResult.msg}
          </motion.div>
        )}
      </Section>

      {/* ── PREFERENCES ── */}
      <Section title="Preferences" icon="⚙">
        <ToggleRow label="Reduced motion" sub="Simplify animations"
          value={settings.reducedMotion}
          onChange={v => handleSettingChange('reducedMotion', v)} />
        <ToggleRow label="Notifications" sub="Reminders and alerts"
          value={settings.notificationsEnabled}
          onChange={requestNotifications} />
      </Section>

      {/* ── STORAGE ── */}
      <Section title="Storage" icon="💾">
        <button className={styles.btnSecondary} onClick={checkStorage}>
          Check storage usage
        </button>
        {storageInfo && (
          <div className={styles.storageInfo}>
            <div className={styles.storageStat}>
              <span className={styles.storageVal}>{(storageInfo.used / (1024*1024)).toFixed(1)} MB</span>
              <span className={styles.storageLabel}>Used</span>
            </div>
            <div className={styles.storageDivider} />
            <div className={styles.storageStat}>
              <span className={styles.storageVal}>{(storageInfo.quota / (1024*1024*1024)).toFixed(1)} GB</span>
              <span className={styles.storageLabel}>Quota</span>
            </div>
          </div>
        )}
      </Section>

      {/* ── ABOUT ── */}
      <Section title="About" icon="✦">
        <div className={styles.aboutBlock}>
          <span className={styles.aboutLogo}>IMMORTAIL™</span>
          <span className={styles.aboutSub}>Your dog, forever.</span>
          <span className={styles.aboutVer}>Version 1.0.0 · Offline-first PWA</span>
        </div>
      </Section>
    </div>
  );
}

// ── SUB-COMPONENTS ──────────────────────────────────────────────

function Section({ title, icon, children }) {
  return (
    <motion.div className={styles.section}
      initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
      <div className={styles.sectionHeader}>
        <span className={styles.sectionIcon}>{icon}</span>
        <span className={styles.sectionTitle}>{title}</span>
      </div>
      <div className={styles.sectionBody}>{children}</div>
    </motion.div>
  );
}

function FieldRow({ label, children }) {
  return (
    <div className={styles.fieldRow}>
      <label className={styles.fieldLabel}>{label}</label>
      {children}
    </div>
  );
}

function ToggleRow({ label, sub, value, onChange }) {
  return (
    <div className={styles.toggleRow}>
      <div className={styles.toggleInfo}>
        <span className={styles.toggleLabel}>{label}</span>
        {sub && <span className={styles.toggleSub}>{sub}</span>}
      </div>
      <label className={styles.toggle}>
        <input type="checkbox" checked={!!value} onChange={e => onChange(e.target.checked)} />
        <span className={styles.toggleSlider} />
      </label>
    </div>
  );
}
