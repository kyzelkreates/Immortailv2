// ================================================================
// IMMORTAIL™ — DOG PRESENCE
// Cinematic living orb. Emotionally reactive. Breathing. Sacred.
// The heart of the entire experience.
// ================================================================

import React, { useRef, useEffect, useCallback, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  registerEmotionAnimation,
  registerDogImageAnimation,
  clearGroup,
  startLoop,
} from '@/core/animationEngine.js';
import { eventBus } from '@/core/eventBus.js';
import { EVENT, EMOTION, EMOTION_COLOR } from '@/core/constants.js';
import styles from './DogPresence.module.css';

const RIPPLE_DURATION = 900;

export default function DogPresence({ dog, mediaUrl, emotion, intensity, onTap }) {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const [ripples, setRipples] = useState([]);
  const [currentEmotion, setCurrentEmotion] = useState(emotion || EMOTION.NEUTRAL);
  const [currentIntensity, setCurrentIntensity] = useState(intensity ?? 0.5);
  const [tapped, setTapped] = useState(false);

  // Resize canvas
  const resize = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;
    const { width, height } = container.getBoundingClientRect();
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }
  }, []);

  useEffect(() => {
    resize();
    const observer = new ResizeObserver(resize);
    if (containerRef.current) observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, [resize]);

  // Register animations
  useEffect(() => {
    clearGroup('presence');
    clearGroup('dog_layer');
    registerEmotionAnimation(canvasRef);
    if (mediaUrl) registerDogImageAnimation(canvasRef, mediaUrl);
    startLoop();
    return () => {
      clearGroup('presence');
      clearGroup('dog_layer');
    };
  }, [mediaUrl]);

  // Track emotion changes
  useEffect(() => {
    const off = eventBus.on(EVENT.EMOTION_CHANGED, ({ emotion: e, intensity: i }) => {
      setCurrentEmotion(e);
      setCurrentIntensity(i ?? 0.5);
    });
    return off;
  }, []);

  useEffect(() => {
    setCurrentEmotion(emotion || EMOTION.NEUTRAL);
  }, [emotion]);

  useEffect(() => {
    setCurrentIntensity(intensity ?? 0.5);
  }, [intensity]);

  const handleTap = useCallback((e) => {
    // Create ripple at tap position
    const rect = containerRef.current?.getBoundingClientRect();
    if (rect) {
      const x = ((e.clientX || e.touches?.[0]?.clientX || rect.left + rect.width / 2) - rect.left) / rect.width * 100;
      const y = ((e.clientY || e.touches?.[0]?.clientY || rect.top + rect.height / 2) - rect.top) / rect.height * 100;
      const id = Date.now();
      setRipples(r => [...r, { id, x, y }]);
      setTimeout(() => setRipples(r => r.filter(rip => rip.id !== id)), RIPPLE_DURATION);
    }
    setTapped(true);
    setTimeout(() => setTapped(false), 600);
    if (onTap) onTap();
  }, [onTap]);

  // Glow colour derived from emotion
  const glowColor = EMOTION_COLOR[currentEmotion] || EMOTION_COLOR[EMOTION.NEUTRAL];
  const glowIntensity = 0.2 + currentIntensity * 0.5;

  return (
    <div
      ref={containerRef}
      className={styles.container}
      onClick={handleTap}
      aria-label={dog ? `${dog.name}'s presence — tap to interact` : 'Your companion'}
    >
      {/* Ambient outer glow ring */}
      <div
        className={styles.glowRing}
        style={{
          boxShadow: `0 0 60px ${glowColor}${Math.round(glowIntensity * 255).toString(16).padStart(2,'0')},
                      0 0 120px ${glowColor}${Math.round(glowIntensity * 0.4 * 255).toString(16).padStart(2,'0')}`,
          borderColor: `${glowColor}30`,
        }}
      />

      {/* Secondary breathing ring */}
      <div
        className={styles.breathRing}
        style={{ borderColor: `${glowColor}18` }}
      />

      {/* Canvas — animation engine renders here */}
      <canvas ref={canvasRef} className={styles.canvas} />

      {/* Ripple effects on tap */}
      {ripples.map(r => (
        <div
          key={r.id}
          className={styles.ripple}
          style={{
            left: `${r.x}%`,
            top: `${r.y}%`,
            borderColor: `${glowColor}60`,
          }}
        />
      ))}

      {/* Tap pulse overlay */}
      <AnimatePresence>
        {tapped && (
          <motion.div
            className={styles.tapPulse}
            initial={{ opacity: 0.5, scale: 0.8 }}
            animate={{ opacity: 0, scale: 1.4 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.6, ease: 'easeOut' }}
            style={{ background: `radial-gradient(circle, ${glowColor}20, transparent 70%)` }}
          />
        )}
      </AnimatePresence>

      {/* Fallback — no media yet */}
      {!mediaUrl && dog && (
        <div className={styles.fallback}>
          <motion.span
            className={styles.paw}
            animate={{ scale: [1, 1.08, 1], opacity: [0.6, 1, 0.6] }}
            transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
          >
            🐾
          </motion.span>
          <span className={styles.fallbackName}>{dog.name}</span>
        </div>
      )}
    </div>
  );
}
