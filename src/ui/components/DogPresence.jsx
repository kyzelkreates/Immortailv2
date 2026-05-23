// ================================================================
// IMMORTAIL™ — DOG PRESENCE
// Renders the dog's visual — canvas-based emotional orb
// layered under actual dog photos. Fully animation-engine driven.
// ================================================================

import React, { useRef, useEffect, useCallback } from 'react';
import {
  registerEmotionAnimation,
  registerDogImageAnimation,
  clearGroup,
  startLoop,
} from '@/core/animationEngine.js';
import { eventBus } from '@/core/eventBus.js';
import { EVENT } from '@/core/constants.js';
import styles from './DogPresence.module.css';

export default function DogPresence({ dog, mediaUrl, emotion, intensity, onTap }) {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);

  // Resize canvas to container
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
    if (mediaUrl) {
      registerDogImageAnimation(canvasRef, mediaUrl);
    }
    startLoop();
    return () => {
      clearGroup('presence');
      clearGroup('dog_layer');
    };
  }, [mediaUrl]);

  const handleTap = useCallback(() => {
    if (onTap) onTap();
  }, [onTap]);

  return (
    <div ref={containerRef} className={styles.container}>
      <canvas
        ref={canvasRef}
        className={styles.canvas}
        onClick={handleTap}
        aria-label={dog ? `${dog.name}'s presence` : 'Your companion'}
      />
      {!mediaUrl && dog && (
        <div className={styles.nameFallback}>
          <span className={styles.paw}>🐾</span>
          <span className={styles.name}>{dog.name}</span>
        </div>
      )}
    </div>
  );
}
