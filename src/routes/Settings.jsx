// ================================================================
// IMMORTAIL™ — SETTINGS ROUTE
// App preferences + full AI provider configuration.
// Ollama, OpenAI-compatible, custom endpoint.
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
      showToast('AI settings saved', 'success');
    } catch (err) {
      showToast(`Save failed: ${err.message}`, 'error');
    }
  }, [aiSettings]);

  const testConnection = useCallback(async () => {
    setTesting(true);
    setTestResult(null);
    try {
      await updateAiSettings(aiSettings);
      const result = await setupAiProvider();
      setTestResult(result.ready ? { ok: true, msg: 'Connection successful' } : { ok: false, msg: 'Could not connect — check URL/model' });
    } catch (err) {
      setTestResult({ ok: false, msg: err.message });
    } finally {
      setTesting(false);
    }
  }, [aiSettings]);

  const requestNotifications = useCallback(async () => {
    const granted = await requestNotificationPermission();
    if (granted) { showToast('Notifications enabled', 'success'); handleSettingChange('notificationsEnabled', true); }
    else showToast('Notification permission denied', 'error');
  }, [handleSettingChange]);

  const checkStorage = useCallback(async () => {
    const info = await getCacheSize();
    setStorageInfo(info);
    await requestPersistentStorage();
  }, []);

  return (
    <div className={styles.container}>
      <h1 className={styles.title}>Settings</h1>

      {/* AI PROVIDER */}
      <Section title="AI Provider" icon="🤖">
        <div className={styles.field}>
          <label className={styles.label}>Provider</label>
          <select className={styles.select} value={aiSettings.provider}
            onChange={e => handleAiChange('provider', e.target.value)}>
            <option value={AI_PROVIDER.NONE}>None (local only)</option>
            <option value={AI_PROVIDER.OLLAMA}>Ollama (local)</option>
            <option value={AI_PROVIDER.OPENAI_COMPAT}>OpenAI-compatible API</option>
            <option value={AI_PROVIDER.CUSTOM}>Custom endpoint</option>
          </select>
        </div>

        <AnimatePresence mode="wait">
          {aiSettings.provider === AI_PROVIDER.OLLAMA && (
            <motion.div key="ollama" className={styles.providerFields}
              initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>
              <div className={styles.field}>
                <label className={styles.label}>Ollama URL</label>
                <input className={styles.input} placeholder="http://localhost:11434"
                  value={aiSettings.ollamaUrl} onChange={e => handleAiChange('ollamaUrl', e.target.value)} />
              </div>
              <div className={styles.field}>
                <label className={styles.label}>Model name</label>
                <input className={styles.input} placeholder="e.g. llama3, mistral, gemma"
                  value={aiSettings.ollamaModel} onChange={e => handleAiChange('ollamaModel', e.target.value)} />
              </div>
              <p className={styles.hint}>
                Run Ollama locally: <code>ollama serve</code> then <code>ollama pull llama3</code>
              </p>
            </motion.div>
          )}

          {aiSettings.provider === AI_PROVIDER.OPENAI_COMPAT && (
            <motion.div key="openai" className={styles.providerFields}
              initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>
              <div className={styles.field}>
                <label className={styles.label}>Base URL</label>
                <input className={styles.input} placeholder="https://api.openai.com/v1"
                  value={aiSettings.openaiCompatUrl} onChange={e => handleAiChange('openaiCompatUrl', e.target.value)} />
              </div>
              <div className={styles.field}>
                <label className={styles.label}>API Key</label>
                <input className={styles.input} type="password" placeholder="sk-..."
                  value={aiSettings.openaiCompatKey} onChange={e => handleAiChange('openaiCompatKey', e.target.value)} />
              </div>
              <div className={styles.field}>
                <label className={styles.label}>Model</label>
                <input className={styles.input} placeholder="gpt-4o, claude-3-haiku, etc."
                  value={aiSettings.openaiCompatModel} onChange={e => handleAiChange('openaiCompatModel', e.target.value)} />
              </div>
            </motion.div>
          )}

          {aiSettings.provider === AI_PROVIDER.CUSTOM && (
            <motion.div key="custom" className={styles.providerFields}
              initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>
              <div className={styles.field}>
                <label className={styles.label}>Endpoint URL</label>
                <input className={styles.input} placeholder="https://your-api.example.com/v1/chat"
                  value={aiSettings.customUrl} onChange={e => handleAiChange('customUrl', e.target.value)} />
              </div>
              <div className={styles.field}>
                <label className={styles.label}>Model</label>
                <input className={styles.input} placeholder="model name"
                  value={aiSettings.customModel} onChange={e => handleAiChange('customModel', e.target.value)} />
              </div>
              <div className={styles.field}>
                <label className={styles.label}>Headers (JSON)</label>
                <textarea className={styles.textarea} placeholder='{"Authorization": "Bearer token"}'
                  value={aiSettings.customHeaders} onChange={e => handleAiChange('customHeaders', e.target.value)} rows={2} />
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {aiSettings.provider !== AI_PROVIDER.NONE && (
          <>
            <div className={styles.field}>
              <label className={styles.label}>System prompt</label>
              <textarea className={styles.textarea}
                placeholder="You are a warm, emotionally intelligent presence for my dog…"
                value={aiSettings.systemPrompt}
                onChange={e => handleAiChange('systemPrompt', e.target.value)} rows={3} />
            </div>
            <div className={styles.inlineFields}>
              <div className={styles.field}>
                <label className={styles.label}>Temperature ({aiSettings.temperature})</label>
                <input type="range" min="0" max="1" step="0.05" className={styles.range}
                  value={aiSettings.temperature} onChange={e => handleAiChange('temperature', parseFloat(e.target.value))} />
              </div>
              <div className={styles.field}>
                <label className={styles.label}>Max tokens</label>
                <input className={styles.input} type="number" min="50" max="2000"
                  value={aiSettings.maxTokens} onChange={e => handleAiChange('maxTokens', parseInt(e.target.value))} />
              </div>
            </div>
          </>
        )}

        <div className={styles.aiActions}>
          <button className={styles.btnSecondary} onClick={saveAiSettings}>Save</button>
          {aiSettings.provider !== AI_PROVIDER.NONE && (
            <button className={styles.btnPrimary} onClick={testConnection} disabled={testing}>
              {testing ? 'Testing…' : 'Test Connection'}
            </button>
          )}
        </div>

        {testResult && (
          <div className={`${styles.testResult} ${testResult.ok ? styles.ok : styles.fail}`}>
            {testResult.ok ? '✓' : '✗'} {testResult.msg}
          </div>
        )}
      </Section>

      {/* APP PREFERENCES */}
      <Section title="Preferences" icon="⚙">
        <ToggleRow
          label="Reduced motion"
          description="Simplify animations"
          value={settings.reducedMotion}
          onChange={v => handleSettingChange('reducedMotion', v)}
        />
        <ToggleRow
          label="Notifications"
          description="Allow reminders and alerts"
          value={settings.notificationsEnabled}
          onChange={requestNotifications}
        />
      </Section>

      {/* STORAGE */}
      <Section title="Storage" icon="💾">
        <button className={styles.btnSecondary} onClick={checkStorage}>Check storage usage</button>
        {storageInfo && (
          <div className={styles.storageInfo}>
            <span>Used: {(storageInfo.used / (1024*1024)).toFixed(1)} MB</span>
            <span>Quota: {(storageInfo.quota / (1024*1024*1024)).toFixed(1)} GB</span>
            <span>{storageInfo.percentUsed}% used</span>
          </div>
        )}
        <p className={styles.hint}>All data is stored locally on your device. Nothing is sent to any server.</p>
      </Section>

      {/* ABOUT */}
      <Section title="About" icon="✦">
        <p className={styles.aboutText}>IMMORTAIL™ v1.0.0</p>
        <p className={styles.aboutText}>Your dog, forever.</p>
        <p className={styles.hint}>Built offline-first. Your data never leaves your device.</p>
      </Section>
    </div>
  );
}

function Section({ title, icon, children }) {
  return (
    <div className={styles.section}>
      <div className={styles.sectionHeader}>
        <span className={styles.sectionIcon}>{icon}</span>
        <h2 className={styles.sectionTitle}>{title}</h2>
      </div>
      <div className={styles.sectionBody}>{children}</div>
    </div>
  );
}

function ToggleRow({ label, description, value, onChange }) {
  return (
    <div className={styles.toggleRow}>
      <div>
        <div className={styles.toggleLabel}>{label}</div>
        {description && <div className={styles.toggleDesc}>{description}</div>}
      </div>
      <button
        className={`${styles.toggle} ${value ? styles.toggleOn : ''}`}
        onClick={() => onChange(!value)}
        role="switch"
        aria-checked={value}
      >
        <motion.div className={styles.toggleThumb} layout transition={{ type: 'spring', stiffness: 500, damping: 30 }} />
      </button>
    </div>
  );
}
