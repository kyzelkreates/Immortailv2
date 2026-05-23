// ================================================================
// IMMORTAIL™ — HOME
// The living emotional sanctuary. Not an app screen.
// A space you enter. A presence that waited for you.
// ================================================================

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { getState } from '@/core/storage.js';
import { eventBus } from '@/core/eventBus.js';
import { EVENT, EMOTION } from '@/core/constants.js';
import { applyEmotion, deriveEmotionFromInteraction } from '@/systems/emotionSystem/emotionSystem.js';
import { recordInteraction } from '@/systems/dogSystem/dogSystem.js';
import { runInference } from '@/core/aiEngine.js';
import { getMedia } from '@/storage/indexedDb.js';
import DogPresence from '@/ui/components/DogPresence.jsx';
import styles from './Home.module.css';

const INTERACTIONS = [
  { id: 'pet',  label: 'Pet',  emoji: '🤍' },
  { id: 'play', label: 'Play', emoji: '🎾' },
  { id: 'talk', label: 'Talk', emoji: '💛' },
  { id: 'miss', label: 'Miss', emoji: '🕯️' },
];

// Cinematic greeting — feels like it was waiting
function buildGreeting(dog) {
  if (!dog) return '';
  const hour = new Date().getHours();
  const greetings = hour < 5
    ? [`Still here with you, even now.`, `The night is quieter with you here.`]
    : hour < 12
    ? [`Good morning. ${dog.name} feels your presence.`, `A new day, and you remembered.`]
    : hour < 17
    ? [`${dog.name} has been waiting for you.`, `You came back. ${dog.name} knew you would.`]
    : hour < 21
    ? [`The evening feels warmer now.`, `${dog.name}'s presence deepens as the day slows.`]
    : [`Here in the quiet, ${dog.name} is close.`, `Even in the night, the love remains.`];
  return greetings[Math.floor(Math.random() * greetings.length)];
}

function daysSince(dateStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (isNaN(d)) return null;
  return Math.floor((Date.now() - d.getTime()) / (1000 * 60 * 60 * 24));
}

export default function Home() {
  const [dog, setDog] = useState(getState().activeDog);
  const [emotion, setEmotionState] = useState(getState().currentEmotion || EMOTION.NEUTRAL);
  const [intensity, setIntensity] = useState(getState().emotionIntensity ?? 0.5);
  const [mediaUrl, setMediaUrl] = useState(null);
  const [aiMessage, setAiMessage] = useState('');
  const [chatInput, setChatInput] = useState('');
  const [thinking, setThinking] = useState(false);
  const [activeBtn, setActiveBtn] = useState(null);
  const [tapCount, setTapCount] = useState(0);
  const [greeting, setGreeting] = useState('');
  const [greetingVisible, setGreetingVisible] = useState(false);
  const [inputFocused, setInputFocused] = useState(false);
  const urlRef = useRef(null);
  const greetingShown = useRef(false);

  useEffect(() => {
    const off1 = eventBus.on(EVENT.DOG_LOADED, ({ dog: d }) => { setDog(d); });
    const off2 = eventBus.on(EVENT.EMOTION_CHANGED, ({ emotion: e, intensity: i }) => {
      setEmotionState(e); setIntensity(i ?? 0.5);
    });
    return () => { off1(); off2(); };
  }, []);

  // Show cinematic greeting on entry
  useEffect(() => {
    if (dog && !greetingShown.current) {
      greetingShown.current = true;
      const g = buildGreeting(dog);
      setGreeting(g);
      const t1 = setTimeout(() => setGreetingVisible(true), 600);
      const t2 = setTimeout(() => setGreetingVisible(false), 5000);
      return () => { clearTimeout(t1); clearTimeout(t2); };
    }
  }, [dog]);

  // Load cover photo
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
    setTimeout(() => setActiveBtn(null), 500);
    setTapCount(c => c + 1);
    const { emotion: newEmotion, intensity: newIntensity } = deriveEmotionFromInteraction(interactionId);
    applyEmotion(newEmotion, newIntensity, dog.id, interactionId);
    await recordInteraction(dog.id);
    try {
      setThinking(true);
      setAiMessage('');
      const prompts = {
        pet:  `The user gently petted their dog ${dog.name}. Respond warmly as ${dog.name}'s spirit — one tender, intimate sentence. No more.`,
        play: `The user wants to play with ${dog.name}. Channel ${dog.name}'s joyful energy — one spirited, warm sentence. No more.`,
        talk: `The user reached out to talk to ${dog.name}. Respond as ${dog.name} listening — one gentle, present sentence. No more.`,
        miss: `The user is deeply missing ${dog.name}. Respond from ${dog.name}'s presence with pure comfort — one warm, reassuring sentence. No more.`,
      };
      const result = await runInference(prompts[interactionId] || prompts.pet);
      if (result?.text) setAiMessage(result.text);
    } catch { /* AI not configured — silent fail */ } finally { setThinking(false); }
  }, [dog, thinking]);

  const handleTalkSubmit = useCallback(async (e) => {
    e?.preventDefault();
    if (!chatInput.trim() || thinking || !dog) return;
    const input = chatInput.trim();
    setChatInput('');
    setThinking(true);
    setAiMessage('');
    try {
      const result = await runInference(
        `The user said to their dog ${dog.name}: "${input}". Respond as ${dog.name}'s warm, loving presence — one heartfelt sentence. No more.`
      );
      if (result?.text) setAiMessage(result.text);
    } catch { } finally { setThinking(false); }
  }, [chatInput, dog, thinking]);

  if (!dog) return null;

  const daysMissed = daysSince(dog.passedDate);
  const daysKnown  = daysSince(dog.birthDate);

  return (
    <div className={styles.sanctuary}>

      {/* CINEMATIC GREETING — fades in, fades out */}
      <AnimatePresence>
        {greetingVisible && (
          <motion.div
            className={styles.greetingOverlay}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1.2, ease: 'easeInOut' }}
          >
            <motion.p
              className={styles.greetingText}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ delay: 0.3, duration: 1.0 }}
            >
              {greeting}
            </motion.p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* PRESENCE — the emotional centrepiece */}
      <motion.div
        className={styles.presenceStage}
        initial={{ opacity: 0, scale: 0.92 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
      >
        <DogPresence
          dog={dog}
          mediaUrl={mediaUrl}
          emotion={emotion}
          intensity={intensity}
          onTap={() => handleInteraction('pet')}
        />
      </motion.div>

      {/* NAME PLATE */}
      <motion.div
        className={styles.nameplate}
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5, duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
      >
        <h1 className={styles.dogName}>{dog.name}</h1>
        {dog.breed && <span className={styles.breed}>{dog.breed}</span>}
      </motion.div>

      {/* STATS */}
      {(daysMissed !== null || daysKnown !== null || tapCount > 0) && (
        <motion.div
          className={styles.statsRow}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8, duration: 0.8 }}
        >
          {daysMissed !== null && (
            <div className={styles.stat}>
              <span className={styles.statValue}>{daysMissed}</span>
              <span className={styles.statLabel}>days missed</span>
            </div>
          )}
          {daysKnown !== null && (
            <div className={styles.stat}>
              <span className={styles.statValue}>{daysKnown}</span>
              <span className={styles.statLabel}>days loved</span>
            </div>
          )}
          {tapCount > 0 && (
            <div className={styles.stat}>
              <span className={styles.statValue}>{tapCount}</span>
              <span className={styles.statLabel}>moments shared</span>
            </div>
          )}
        </motion.div>
      )}

      {/* AI MESSAGE AREA */}
      <div className={styles.messageArea}>
        <AnimatePresence mode="wait">
          {thinking ? (
            <motion.div key="thinking" className={styles.thinkingRow}
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              {[0,1,2].map(i => (
                <motion.div key={i} className={styles.thinkingDot}
                  animate={{ y: [0, -5, 0], opacity: [0.3, 1, 0.3] }}
                  transition={{ duration: 1.1, repeat: Infinity, delay: i * 0.22, ease: 'easeInOut' }}
                />
              ))}
            </motion.div>
          ) : aiMessage ? (
            <motion.p key={aiMessage} className={styles.aiMessage}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}>
              {aiMessage}
            </motion.p>
          ) : (
            <motion.p key="hint" className={styles.hint}
              initial={{ opacity: 0 }} animate={{ opacity: 0.45 }}
              transition={{ delay: 1.2 }}>
              Touch {dog.name} to feel their presence
            </motion.p>
          )}
        </AnimatePresence>
      </div>

      {/* INTERACTION BUTTONS */}
      <motion.div
        className={styles.interactions}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.9, duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
      >
        {INTERACTIONS.map(({ id, label, emoji }) => (
          <motion.button
            key={id}
            className={`${styles.interactionBtn} ${activeBtn === id ? styles.interactionActive : ''}`}
            onClick={() => handleInteraction(id)}
            disabled={thinking}
            whileTap={{ scale: 0.88 }}
            animate={activeBtn === id ? { scale: [1, 0.88, 1.06, 1] } : {}}
            transition={{ duration: 0.4 }}
          >
            <span className={styles.interactionEmoji}>{emoji}</span>
            <span className={styles.interactionLabel}>{label}</span>
          </motion.button>
        ))}
      </motion.div>

      {/* TALK INPUT */}
      <motion.form
        className={`${styles.talkForm} ${inputFocused ? styles.talkFormFocused : ''}`}
        onSubmit={handleTalkSubmit}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 1.0, duration: 0.8 }}
      >
        <input
          className={styles.talkInput}
          placeholder={`Say something to ${dog.name}…`}
          value={chatInput}
          onChange={e => setChatInput(e.target.value)}
          onFocus={() => setInputFocused(true)}
          onBlur={() => setInputFocused(false)}
          disabled={thinking}
        />
        <motion.button
          type="submit"
          className={styles.talkBtn}
          disabled={!chatInput.trim() || thinking}
          whileTap={{ scale: 0.88 }}
        >
          ›
        </motion.button>
      </motion.form>

    </div>
  );
}
