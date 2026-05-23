// ================================================================
// IMMORTAIL™ — ENTRY POINT
// ================================================================

import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';

// PWA Service Worker registration
async function registerSW() {
  if ('serviceWorker' in navigator) {
    try {
      const reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
      reg.addEventListener('updatefound', () => {
        const newWorker = reg.installing;
        if (!newWorker) return;
        newWorker.addEventListener('statechange', () => {
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            // New version available — prompt user (handled in-app if needed)
            console.info('[SW] New version available. Refresh to update.');
          }
        });
      });
    } catch (err) {
      console.warn('[SW] Registration failed:', err.message);
    }
  }
}

registerSW();

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
