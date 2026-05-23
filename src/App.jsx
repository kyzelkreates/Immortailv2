// ================================================================
// IMMORTAIL™ — APP ROOT
// Handles initialization, routing, and layout shell.
// No business logic lives here — delegates to systems.
// ================================================================

import React, { useState, useEffect, useRef } from 'react';
import { AnimatePresence, motion } from 'framer-motion';

import { initStorage, getState, isSetupComplete } from '@/core/storage.js';
import { initRouter, onRouteChange, getCurrentRoute, navigate } from '@/core/router.js';
import { initAnimationEngine, startLoop } from '@/core/animationEngine.js';
import { initGlobalErrorHandlers, AppErrorBoundary } from '@/core/errorBoundary.js';
import { runRecoveryCheck } from '@/core/recoveryEngine.js';
import { initAiEngine } from '@/core/aiEngine.js';
import { initMemorySystem } from '@/systems/memorySystem/memorySystem.js';
import { initMediaIngest } from '@/systems/persistenceSystem/mediaIngest.js';
import { initNotifications } from '@/systems/notificationSystem/notificationSystem.js';
import { loadDogProfile } from '@/systems/dogSystem/dogSystem.js';
import { eventBus } from '@/core/eventBus.js';
import { EVENT, ROUTES } from '@/core/constants.js';

import { AppErrorBoundary as ErrorBoundary } from '@/core/errorBoundary.js';
import LoadingOverlay from '@/ui/loading/LoadingOverlay.jsx';
import ToastContainer from '@/ui/feedback/Toast.jsx';
import NavBar from '@/ui/components/NavBar.jsx';

import Home from '@/routes/Home.jsx';
import MyDog from '@/routes/MyDog.jsx';
import Memories from '@/routes/Memories.jsx';
import Settings from '@/routes/Settings.jsx';
import Setup from '@/routes/Setup.jsx';

import '@/styles/global.css';

// ----------------------------------------------------------------
// ROUTE → COMPONENT MAP
// ----------------------------------------------------------------
const ROUTE_COMPONENTS = {
  [ROUTES.HOME]:     Home,
  [ROUTES.MY_DOG]:   MyDog,
  [ROUTES.MEMORIES]: Memories,
  [ROUTES.SETTINGS]: Settings,
  [ROUTES.SETUP]:    Setup,
};

const HIDE_NAV = [ROUTES.SETUP];

// ----------------------------------------------------------------
// APP BOOT SEQUENCE
// ----------------------------------------------------------------
async function boot() {
  initGlobalErrorHandlers();
  await initStorage();
  initRouter();
  initAnimationEngine();
  initAiEngine();
  initMemorySystem();
  initMediaIngest();
  await initNotifications();

  const state = getState();

  // Load active dog profile if setup is complete
  if (state.setupComplete && state.activeDogId) {
    try {
      await loadDogProfile(state.activeDogId);
    } catch (err) {
      console.warn('[App] Dog profile load failed:', err.message);
    }
  }

  // Run recovery check
  await runRecoveryCheck();

  startLoop();

  return getState();
}

// ----------------------------------------------------------------
// ROOT COMPONENT
// ----------------------------------------------------------------
export default function App() {
  const [ready, setReady] = useState(false);
  const [route, setRoute] = useState(ROUTES.HOME);
  const [bootError, setBootError] = useState(null);
  const booted = useRef(false);

  useEffect(() => {
    if (booted.current) return;
    booted.current = true;

    boot()
      .then(state => {
        const initial = state.setupComplete ? (state.currentRoute || ROUTES.HOME) : ROUTES.SETUP;
        setRoute(initial);
        setReady(true);
      })
      .catch(err => {
        console.error('[App] Boot failed:', err);
        setBootError(err.message);
        setReady(true); // still render — error boundary catches it
      });
  }, []);

  useEffect(() => {
    if (!ready) return;
    const off = onRouteChange((newRoute) => setRoute(newRoute));
    return off;
  }, [ready]);

  if (!ready) {
    return (
      <div style={splashStyle}>
        <motion.div
          animate={{ opacity: [0.3, 1, 0.3] }}
          transition={{ duration: 2, repeat: Infinity }}
          style={{ fontSize: 48 }}
        >
          🐾
        </motion.div>
      </div>
    );
  }

  if (bootError) {
    return (
      <div style={splashStyle}>
        <div style={{ textAlign: 'center', color: '#e87a7a' }}>
          <div style={{ fontSize: 36, marginBottom: 12 }}>⚠</div>
          <p style={{ color: '#c0c0d8' }}>Failed to start: {bootError}</p>
          <button onClick={() => window.location.reload()} style={reloadBtnStyle}>Reload</button>
        </div>
      </div>
    );
  }

  const RouteComponent = ROUTE_COMPONENTS[route] || Home;
  const showNav = !HIDE_NAV.includes(route);

  return (
    <AppErrorBoundary>
      <AnimatePresence mode="wait">
        <motion.div
          key={route}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          style={{ minHeight: '100dvh' }}
        >
          <RouteComponent />
        </motion.div>
      </AnimatePresence>

      {showNav && <NavBar currentRoute={route} />}
      <LoadingOverlay />
      <ToastContainer />
    </AppErrorBoundary>
  );
}

const splashStyle = {
  minHeight: '100dvh',
  background: '#0a0a0f',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
};

const reloadBtnStyle = {
  background: '#5c5cff',
  color: '#fff',
  border: 'none',
  borderRadius: '10px',
  padding: '12px 24px',
  fontSize: '14px',
  fontWeight: 600,
  cursor: 'pointer',
  marginTop: '16px',
};
