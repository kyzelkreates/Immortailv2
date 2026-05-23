// ================================================================
// IMMORTAIL™ — LOADING OVERLAY
// Shown during all long tasks. Animated, never frozen.
// Listens to eventBus — no direct state coupling.
// ================================================================

import React, { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { eventBus } from '@/core/eventBus.js';
import { EVENT } from '@/core/constants.js';
import styles from './LoadingOverlay.module.css';

export default function LoadingOverlay() {
  const [state, setState] = useState({
    visible: false,
    message: '',
    progress: 0,
    cancellable: false,
  });

  useEffect(() => {
    const showOff = eventBus.on(EVENT.LOADING_SHOW, ({ message, progress, cancellable }) => {
      setState({ visible: true, message: message || 'Loading…', progress: progress || 0, cancellable: !!cancellable });
    });
    const hideOff = eventBus.on(EVENT.LOADING_HIDE, () => {
      setState(s => ({ ...s, visible: false }));
    });
    const progressOff = eventBus.on(EVENT.TASK_PROGRESS, ({ progress, message }) => {
      setState(s => ({ ...s, progress: progress ?? s.progress, message: message ?? s.message }));
    });

    return () => { showOff(); hideOff(); progressOff(); };
  }, []);

  return (
    <AnimatePresence>
      {state.visible && (
        <motion.div
          className={styles.overlay}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
        >
          <div className={styles.card}>
            <PawSpinner />
            <p className={styles.message}>{state.message}</p>
            {state.progress > 0 && state.progress < 100 && (
              <div className={styles.progressBar}>
                <motion.div
                  className={styles.progressFill}
                  animate={{ width: `${state.progress}%` }}
                  transition={{ duration: 0.3, ease: 'easeOut' }}
                />
              </div>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function PawSpinner() {
  return (
    <motion.div
      className={styles.spinner}
      animate={{ rotate: 360 }}
      transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
    >
      🐾
    </motion.div>
  );
}
