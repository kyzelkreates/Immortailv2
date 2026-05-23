// ================================================================
// IMMORTAIL™ — LOADING OVERLAY
// Metallic gold paw + shimmer logo. Never frozen.
// ================================================================

import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { eventBus } from '@/core/eventBus.js';
import { EVENT } from '@/core/constants.js';
import styles from './LoadingOverlay.module.css';

export default function LoadingOverlay() {
  const [state, setState] = useState({ visible: false, message: '', progress: 0 });

  useEffect(() => {
    const onShow = eventBus.on(EVENT.LOADING_SHOW, ({ message, progress }) => {
      setState({ visible: true, message: message || 'Loading…', progress: progress || 0 });
    });
    const onHide = eventBus.on(EVENT.LOADING_HIDE, () => {
      setState(s => ({ ...s, visible: false }));
    });
    const onProgress = eventBus.on(EVENT.TASK_PROGRESS, ({ progress, message }) => {
      setState(s => ({ ...s, progress: progress ?? s.progress, message: message ?? s.message }));
    });
    return () => { onShow(); onHide(); onProgress(); };
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
          {/* Paw spinner */}
          <motion.div
            className={styles.paw}
            animate={{ rotate: 360 }}
            transition={{ duration: 2.5, repeat: Infinity, ease: 'linear' }}
          >
            🐾
          </motion.div>

          {/* Logo */}
          <div className={styles.logo}>IMMORTAIL™</div>

          {/* Message */}
          <p className={styles.message}>{state.message}</p>

          {/* Progress bar */}
          {state.progress > 0 && state.progress < 100 && (
            <div className={styles.progressTrack}>
              <motion.div
                className={styles.progressFill}
                animate={{ width: `${state.progress}%` }}
                transition={{ duration: 0.3, ease: 'easeOut' }}
              />
            </div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
