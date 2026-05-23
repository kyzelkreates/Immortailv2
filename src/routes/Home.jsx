// ================================================================
// IMMORTAIL™ — HOME ROUTE
// Metallic gold/silver on black. Emotional presence screen.
// ================================================================

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
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
  { id: 'pet',  label: 'Pet',   emoji: '🤍', color: 'rgba(232,232,232,0.15)' },
  { id: 'play', label: 'Play',  emoji: '🎾', color: 'rgba(201,162,39,0.15)' },
  { id: 'talk', label: 'Talk',  emoji: '💛', color: 'rgba(255,215,0,0.12)' },
  { id: 'miss', label: 'Miss',  emoji: '🕯️', color: 'rgba(201,162,39,0.1)' },
];

// How many days since a date
function daysSince(dateStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (isNaN(d)) return null;
  return Math.floor((Date.now() - d.getTime()) / (1000 * 60 * 60 * 24));
}

export default function Home() {
  const [dog, setDog] = useState(getState().activeDog);
  const [emotion, setEmotionState] = useState(getState().currentEmotion);
  const [intensity, setIntensity] = useState(getState().emotionIntensity ?? 0.5);
  const [mediaUrl, setMediaUrl] = useState(null);
  const [aiMessage, setAiMessage] = useState('');
  const [chatInput, setChatInput] = useState('');
  const [thinking, setThinking] = useState(false);
  const [activeBtn, setActiveBtn] = useState(null);
  const [tapCount, setTapCount] = useState(0);
  const urlRef = useRef(null);

  useEffect(() => {
    const off1 = eventBus.on(EVENT.DOG_LOADED, ({ dog: d }) => setDog(d));
    const off2 = eventBus.on(EVENT.EMOTION_CHANGED, ({ emotion: e, intensity: i }) => {
      setEmotionState(e);
      setIntensity(i);
    });
    return () => { off1(); off2(); };
  }, []);

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
    if (!dog || thinking) return;
    setActiveBtn(interactionId);
    setTimeout(() => setActiveBtn(null), 400);
    setTapCount(c => c + 1);
    const { emotion: newEmotion, intensity: newIntensity } = deriveEmotionFromInteraction(interactionId);
    applyEmotion(newEmotion, newIntensity, dog.id, interactionId);
    await recordInteraction(dog.id);
    try {
      setThinking(true);
      const prompts = {
        pet:  `The user gently petted their dog ${dog.name}. Respond warmly as ${dog.name}'s spirit — one tender sentence, as if they can still feel the touch.`,
        play: `The user wants to play with ${dog.name}. Respond with ${dog.name}'s playful energy — one joyful, spirited sentence.`,
        talk: `The user wants to talk to ${dog.name}. Respond as ${dog.name} listening — one gentle, loving sentence.`,
        miss: `The user is missing ${dog.name}. Respond with comfort from ${dog.name}'s perspective — one warm, reassuring sentence.`,
      };
      const result = await runInference(prompts[interactionId] || prompts.pet);
      setAiMessage(result?.text || '');
    } catch {
      setAiMessage('');
    } finally {
      setThinking(false);
    }
  }, [dog, thinking]);

  const handleTalkSubmit = useCallback(async (e) => {
    e?.preventDefault();
    if (!chatInput.trim() || thinking || !dog) return;
    const input = chatInput.trim();
    setChatInput('');
    setThinking(true);
    try {
      const prompt = `The user said to ${dog.name}: "${input}". Respond as ${dog.name}'s warm presence — one heartfelt sentence.`;
      const result = await runInference(prompt);
      setAiMessage(result?.text || '');
    } catch {
      setAiMessage('');
    } finally {
      setThinking(false);
    }
  }, [chatInput, dog, thinking]);

  if (!dog) return null;

  const daysMissed = daysSince(dog.passedDate);
  const daysKnown  = daysSince(dog.birthDate);

  return (
    <div className={styles.container}>

      {/* PRESENCE ORB */}
      <div className={styles.presenceArea}>
        <DogPresence
          dog={dog}
          mediaUrl={mediaUrl}
          emotion={emotion}
          intensity={intensity}
          onTap={() => handleInteraction('pet')}
        />
      </div>

      {/* NAME */}
      <motion.div
        className={styles.nameRow}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        <h1 className={styles.dogName}>{dog.name}</h1>
        {dog.breed && <span className={styles.breed}>{dog.breed}</span>}
      </motion.div>

      {/* STATS */}
      {(daysMissed !== null || daysKnown !== null || tapCount > 0) && (
        <motion.div
          className={styles.statsRow}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35 }}
        >
          {daysMissed !== null && (
            <div className={styles.stat}>
              <span className={styles.statValue}>{daysMissed}</span>
              <span className={styles.statLabel}>Days missed</span>
            </div>
          )}
          {daysKnown !== null && (
            <div className={styles.stat}>
              <span className={styles.statValue}>{daysKnown}</span>
              <span className={styles.statLabel}>Days loved</span>
            </div>
          )}
          <div className={styles.stat}>
            <span className={styles.statValue}>{tapCount}</span>
            <span className={styles.statLabel}>Interactions</span>
          </div>
        </motion.div>
      )}

      {/* AI MESSAGE */}
      <div className={styles.messageArea}>
        <AnimatePresence mode="wait">
          {thinking ? (
            <motion.div
              key="thinking"
              className={styles.thinkingDots}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              {[0,1,2].map(i => (
                <motion.div
                  key={i}
                  className={styles.dot}
                  animate={{ y: [0, -6, 0], opacity: [0.4, 1, 0.4] }}
                  transition={{ duration: 0.8, repeat: Infinity, delay: i * 0.18 }}
                />
              ))}
            </motion.div>
          ) : aiMessage ? (
            <motion.p
              key={aiMessage}
              className={styles.aiMessage}
              initial={{ opacity: 0, y: 10, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.4 }}
            >
              {aiMessage}
            </motion.p>
          ) : (
            <motion.p
              key="hint"
              className={styles.hint}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
            >
              Tap {dog.name} or choose an action below
            </motion.p>
          )}
        </AnimatePresence>
      </div>

      {/* MOOD BAR */}
      <motion.div
        className={styles.moodBar}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
      >
        <div className={styles.moodLabel}>
          <span>Presence energy</span>
          <span>{Math.round((intensity ?? 0.5) * 100)}%</span>
        </div>
        <div className={styles.moodTrack}>
          <div className={styles.moodFill} style={{ width: `${(intensity ?? 0.5) * 100}%` }} />
        </div>
      </motion.div>

      {/* INTERACTION BUTTONS */}
      <motion.div
        className={styles.interactions}
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
      >
        {INTERACTIONS.map(({ id, label, emoji }) => (
          <motion.button
            key={id}
            className={styles.interactionBtn}
            onClick={() => handleInteraction(id)}
            disabled={thinking}
            animate={activeBtn === id ? { scale: [1, 0.88, 1.08, 1] } : {}}
            transition={{ duration: 0.35 }}
            whileTap={{ scale: 0.9 }}
          >
            <span className={styles.interactionEmoji}>{emoji}</span>
            <span className={styles.interactionLabel}>{label}</span>
          </motion.button>
        ))}
      </motion.div>

      {/* TALK INPUT */}
      <motion.form
        className={styles.talkForm}
        onSubmit={handleTalkSubmit}
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
      >
        <input
          className={styles.talkInput}
          placeholder={`Say something to ${dog.name}…`}
          value={chatInput}
          onChange={e => setChatInput(e.target.value)}
          disabled={thinking}
        />
        <button type="submit" className={styles.talkBtn} disabled={!chatInput.trim() || thinking}>
          ›
        </button>
      </motion.form>

    </div>
  );
}
