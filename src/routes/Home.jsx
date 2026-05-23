// ================================================================
// IMMORTAIL™ — HOME ROUTE
// The emotional presence screen. Dog orb + interaction strip.
// ================================================================

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion } from 'framer-motion';
import { getState } from '@/core/storage.js';
import { eventBus } from '@/core/eventBus.js';
import { EVENT } from '@/core/constants.js';
import { applyEmotion, deriveEmotionFromInteraction } from '@/systems/emotionSystem/emotionSystem.js';
import { recordInteraction } from '@/systems/dogSystem/dogSystem.js';
import { runInference } from '@/core/aiEngine.js';
import { getMedia } from '@/storage/indexedDb.js';
import DogPresence from '@/ui/components/DogPresence.jsx';
import { showToast } from '@/ui/feedback/Toast.jsx';
import styles from './Home.module.css';

const INTERACTIONS = [
  { id: 'pet',    label: 'Pet',    emoji: '✋' },
  { id: 'play',   label: 'Play',   emoji: '🎾' },
  { id: 'talk',   label: 'Talk',   emoji: '💬' },
  { id: 'miss',   label: 'Miss',   emoji: '💙' },
];

export default function Home() {
  const [dog, setDog] = useState(getState().activeDog);
  const [emotion, setEmotionState] = useState(getState().currentEmotion);
  const [intensity, setIntensity] = useState(getState().emotionIntensity);
  const [mediaUrl, setMediaUrl] = useState(null);
  const [aiMessage, setAiMessage] = useState('');
  const [chatInput, setChatInput] = useState('');
  const [thinking, setThinking] = useState(false);
  const urlRef = useRef(null);

  // Listen for dog changes
  useEffect(() => {
    const off = eventBus.on(EVENT.DOG_LOADED, ({ dog: d }) => setDog(d));
    const offE = eventBus.on(EVENT.EMOTION_CHANGED, ({ emotion: e, intensity: i }) => {
      setEmotionState(e);
      setIntensity(i);
    });
    return () => { off(); offE(); };
  }, []);

  // Load cover media
  useEffect(() => {
    if (!dog?.coverMediaId) return;
    getMedia(dog.coverMediaId).then(m => {
      if (!m?.blob) return;
      if (urlRef.current) URL.revokeObjectURL(urlRef.current);
      const url = URL.createObjectURL(m.blob);
      urlRef.current = url;
      setMediaUrl(url);
    }).catch(() => {});
    return () => { if (urlRef.current) URL.revokeObjectURL(urlRef.current); };
  }, [dog?.coverMediaId]);

  const handleInteraction = useCallback(async (interactionId) => {
    if (!dog) return;
    const { emotion: newEmotion, intensity: newIntensity } = deriveEmotionFromInteraction(interactionId);
    applyEmotion(newEmotion, newIntensity, dog.id, interactionId);
    await recordInteraction(dog.id);

    // Get AI message for the interaction
    try {
      setThinking(true);
      const prompt = `The user just ${interactionId === 'pet' ? 'petted' : interactionId === 'miss' ? 'said they miss' : interactionId + 'ed with'} their dog ${dog.name}. Respond as ${dog.name}'s emotional presence — one short, warm sentence from ${dog.name}'s perspective.`;
      const result = await runInference(prompt);
      setAiMessage(result?.text || '');
    } catch {
      setAiMessage('');
    } finally {
      setThinking(false);
    }
  }, [dog]);

  const handleTalkSubmit = useCallback(async (e) => {
    e?.preventDefault();
    if (!chatInput.trim() || thinking || !dog) return;
    const input = chatInput.trim();
    setChatInput('');
    setThinking(true);
    try {
      const prompt = `The user said to their dog ${dog.name}: "${input}". Respond as ${dog.name}'s warm emotional presence — one heartfelt, brief sentence.`;
      const result = await runInference(prompt);
      setAiMessage(result?.text || '');
    } catch {
      setAiMessage('');
    } finally {
      setThinking(false);
    }
  }, [chatInput, dog, thinking]);

  if (!dog) return null;

  return (
    <div className={styles.container}>
      {/* DOG PRESENCE */}
      <div className={styles.presenceArea}>
        <DogPresence
          dog={dog}
          mediaUrl={mediaUrl}
          emotion={emotion}
          intensity={intensity}
          onTap={() => handleInteraction('pet')}
        />
      </div>

      {/* DOG NAME */}
      <div className={styles.nameRow}>
        <h1 className={styles.dogName}>{dog.name}</h1>
        {dog.breed && <span className={styles.breed}>{dog.breed}</span>}
      </div>

      {/* AI MESSAGE */}
      <div className={styles.messageArea}>
        {thinking ? (
          <motion.p
            className={styles.thinking}
            animate={{ opacity: [0.4, 1, 0.4] }}
            transition={{ duration: 1.5, repeat: Infinity }}
          >…</motion.p>
        ) : aiMessage ? (
          <motion.p
            key={aiMessage}
            className={styles.aiMessage}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
          >
            "{aiMessage}"
          </motion.p>
        ) : (
          <p className={styles.hint}>Tap {dog.name} or choose an action below</p>
        )}
      </div>

      {/* INTERACTIONS */}
      <div className={styles.interactions}>
        {INTERACTIONS.map(({ id, label, emoji }) => (
          <button
            key={id}
            className={styles.interactionBtn}
            onClick={() => handleInteraction(id)}
            disabled={thinking}
          >
            <span className={styles.interactionEmoji}>{emoji}</span>
            <span className={styles.interactionLabel}>{label}</span>
          </button>
        ))}
      </div>

      {/* TALK INPUT */}
      <form className={styles.talkForm} onSubmit={handleTalkSubmit}>
        <input
          className={styles.talkInput}
          placeholder={`Say something to ${dog.name}…`}
          value={chatInput}
          onChange={e => setChatInput(e.target.value)}
          disabled={thinking}
        />
        <button type="submit" className={styles.talkBtn} disabled={!chatInput.trim() || thinking}>→</button>
      </form>
    </div>
  );
}
