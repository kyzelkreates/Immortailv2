// ================================================================
// IMMORTAIL™ — TOAST NOTIFICATION
// Lightweight in-app feedback. No state bloat.
// ================================================================

import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { eventBus } from '@/core/eventBus.js';
import styles from './Toast.module.css';

const TOAST_EVENT = 'ui:toast';

export function showToast(message, type = 'info', duration = 3000) {
  eventBus.emit(TOAST_EVENT, { message, type, duration });
}

let _toastId = 0;

export default function ToastContainer() {
  const [toasts, setToasts] = useState([]);

  useEffect(() => {
    const off = eventBus.on(TOAST_EVENT, ({ message, type, duration = 3000 }) => {
      const id = ++_toastId;
      setToasts(t => [...t, { id, message, type }]);
      setTimeout(() => {
        setToasts(t => t.filter(x => x.id !== id));
      }, duration);
    });
    return off;
  }, []);

  return (
    <div className={styles.container}>
      <AnimatePresence>
        {toasts.map(toast => (
          <motion.div
            key={toast.id}
            className={`${styles.toast} ${styles[toast.type] || ''}`}
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.95 }}
            transition={{ duration: 0.2 }}
          >
            {toast.message}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
