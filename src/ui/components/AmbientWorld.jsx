// ================================================================
// IMMORTAIL™ — AMBIENT WORLD
// The living cinematic background. Emotional atmosphere layer.
// Particles, glow orbs, atmospheric fog — always present.
// Never blocks interaction. Pure ambience.
// ================================================================

import React, { useEffect, useRef, useCallback, useState } from 'react';
import { eventBus } from '@/core/eventBus.js';
import { EVENT, EMOTION, EMOTION_COLOR } from '@/core/constants.js';
import styles from './AmbientWorld.module.css';

// Particle system
const MAX_PARTICLES = 22;
const PARTICLE_SPAWN_INTERVAL = 1800;

function createParticle(w, h) {
  return {
    id: Math.random(),
    x: Math.random() * w,
    y: h + 10,
    size: 1 + Math.random() * 2.5,
    opacity: 0,
    maxOpacity: 0.15 + Math.random() * 0.35,
    speed: 0.12 + Math.random() * 0.25,
    drift: (Math.random() - 0.5) * 0.4,
    life: 0,
    maxLife: 300 + Math.random() * 400,
  };
}

// Emotion → atmosphere colour mapping
const EMOTION_ATMO = {
  [EMOTION.NEUTRAL]:  { r: 100, g: 100, b: 200 },
  [EMOTION.HAPPY]:    { r: 220, g: 180, b:  60 },
  [EMOTION.PLAYFUL]:  { r: 220, g: 140, b:  70 },
  [EMOTION.CALM]:     { r:  70, g: 170, b: 200 },
  [EMOTION.SLEEPY]:   { r: 120, g: 100, b: 180 },
  [EMOTION.EXCITED]:  { r: 220, g:  80, b: 160 },
  [EMOTION.LOVING]:   { r: 220, g: 110, b: 140 },
  [EMOTION.CURIOUS]:  { r: 100, g: 200, b: 130 },
  [EMOTION.MISSING]:  { r:  70, g: 100, b: 180 },
};

export default function AmbientWorld({ emotion = EMOTION.NEUTRAL, intensity = 0.5 }) {
  const canvasRef = useRef(null);
  const particlesRef = useRef([]);
  const rafRef = useRef(null);
  const lastSpawnRef = useRef(0);
  const [currentEmotion, setCurrentEmotion] = useState(emotion);
  const [currentIntensity, setCurrentIntensity] = useState(intensity);
  const colourRef = useRef(EMOTION_ATMO[emotion] || EMOTION_ATMO[EMOTION.NEUTRAL]);
  const targetColourRef = useRef({ ...colourRef.current });

  // Listen to emotion changes
  useEffect(() => {
    const off = eventBus.on(EVENT.EMOTION_CHANGED, ({ emotion: e, intensity: i }) => {
      setCurrentEmotion(e);
      setCurrentIntensity(i ?? 0.5);
      targetColourRef.current = EMOTION_ATMO[e] || EMOTION_ATMO[EMOTION.NEUTRAL];
    });
    return off;
  }, []);

  const draw = useCallback((ts) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const w = canvas.width;
    const h = canvas.height;

    // Blend colour toward target
    const c = colourRef.current;
    const t = targetColourRef.current;
    const speed = 0.008;
    c.r += (t.r - c.r) * speed;
    c.g += (t.g - c.g) * speed;
    c.b += (t.b - c.b) * speed;

    // Clear with very soft trail (motion blur feel)
    ctx.fillStyle = 'rgba(2,2,8,0.18)';
    ctx.fillRect(0, 0, w, h);

    // Ambient radial glow — breathes with intensity
    const breathe = 0.5 + Math.sin(ts * 0.0004) * 0.06;
    const glowAlpha = 0.06 + currentIntensity * 0.10 * breathe;
    const grad = ctx.createRadialGradient(w * 0.5, h * 0.35, 0, w * 0.5, h * 0.35, w * 0.7);
    grad.addColorStop(0, `rgba(${c.r|0},${c.g|0},${c.b|0},${glowAlpha})`);
    grad.addColorStop(0.5, `rgba(${c.r|0},${c.g|0},${c.b|0},${glowAlpha * 0.3})`);
    grad.addColorStop(1, 'transparent');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    // Secondary glow — bottom warmth
    const warmGrad = ctx.createRadialGradient(w * 0.5, h, 0, w * 0.5, h, w * 0.5);
    warmGrad.addColorStop(0, `rgba(201,162,39,${0.03 + currentIntensity * 0.04})`);
    warmGrad.addColorStop(1, 'transparent');
    ctx.fillStyle = warmGrad;
    ctx.fillRect(0, 0, w, h);

    // Spawn particles
    if (ts - lastSpawnRef.current > PARTICLE_SPAWN_INTERVAL && particlesRef.current.length < MAX_PARTICLES) {
      particlesRef.current.push(createParticle(w, h));
      lastSpawnRef.current = ts;
    }

    // Update & draw particles
    particlesRef.current = particlesRef.current.filter(p => {
      p.life++;
      p.y -= p.speed;
      p.x += p.drift;
      const progress = p.life / p.maxLife;
      p.opacity = progress < 0.15
        ? (progress / 0.15) * p.maxOpacity
        : progress > 0.75
          ? ((1 - progress) / 0.25) * p.maxOpacity
          : p.maxOpacity;

      ctx.save();
      ctx.globalAlpha = p.opacity * (0.5 + currentIntensity * 0.5);
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fillStyle = `rgb(${c.r|0},${c.g|0},${c.b|0})`;
      ctx.shadowBlur = 8;
      ctx.shadowColor = `rgba(${c.r|0},${c.g|0},${c.b|0},0.8)`;
      ctx.fill();
      ctx.restore();

      return p.life < p.maxLife && p.y > -20;
    });

    rafRef.current = requestAnimationFrame(draw);
  }, [currentIntensity]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener('resize', resize);
    rafRef.current = requestAnimationFrame(draw);
    return () => {
      window.removeEventListener('resize', resize);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [draw]);

  // Update intensity ref without restarting loop
  useEffect(() => {
    targetColourRef.current = EMOTION_ATMO[currentEmotion] || EMOTION_ATMO[EMOTION.NEUTRAL];
  }, [currentEmotion]);

  return (
    <div className={styles.world} aria-hidden="true">
      <canvas ref={canvasRef} className={styles.canvas} />
      {/* Static fog layers */}
      <div className={styles.fogTop} />
      <div className={styles.fogBottom} />
    </div>
  );
}
