// ================================================================
// IMMORTAIL™ — APP ROOT
// The vessel for the living world.
// Cinematic boot, emotional transitions, ambient presence.
// ================================================================

import React, { useState, useEffect, useRef } from 'react';
import { AnimatePresence, motion } from 'framer-motion';

import { initStorage, getState } from '@/core/storage.js';
import { initRouter, onRouteChange, navigate } from '@/core/router.js';
import { initAnimationEngine, startLoop } from '@/core/animationEngine.js';
import { initGlobalErrorHandlers, AppErrorBoundary } from '@/core/errorBoundary.js';
import { runRecoveryCheck } from '@/core/recoveryEngine.js';
import { initAiEngine } from '@/core/aiEngine.js';
import { initMemorySystem } from '@/systems/memorySystem/memorySystem.js';
import { initMediaIngest } from '@/systems/persistenceSystem/mediaIngest.js';
import { initNotifications } from '@/systems/notificationSystem/notificationSystem.js';
import { loadDogProfile } from '@/systems/dogSystem/dogSystem.js';
import { eventBus } from '@/core/eventBus.js';
import { EVENT, ROUTES, EMOTION } from '@/core/constants.js';

import LoadingOverlay from '@/ui/loading/LoadingOverlay.jsx';
import ToastContainer from '@/ui/feedback/Toast.jsx';
import NavBar from '@/ui/components/NavBar.jsx';
import AmbientWorld from '@/ui/components/AmbientWorld.jsx';

import Home     from '@/routes/Home.jsx';
import MyDog    from '@/routes/MyDog.jsx';
import Memories from '@/routes/Memories.jsx';
import Settings from '@/routes/Settings.jsx';
import Setup    from '@/routes/Setup.jsx';

import '@/styles/global.css';

const ROUTE_COMPONENTS = {
  [ROUTES.HOME]:     Home,
  [ROUTES.MY_DOG]:   MyDog,
  [ROUTES.MEMORIES]: Memories,
  [ROUTES.SETTINGS]: Settings,
  [ROUTES.SETUP]:    Setup,
};

const HIDE_NAV = [ROUTES.SETUP];

// Cinematic route transition variants — emotionally weighted
const ROUTE_VARIANTS = {
  initial:  { opacity: 0, y: 10,  filter: 'blur(4px)'  },
  animate:  { opacity: 1, y: 0,   filter: 'blur(0px)'  },
  exit:     { opacity: 0, y: -6,  filter: 'blur(3px)'  },
};

const ROUTE_TRANSITION = {
  duration: 0.55,
  ease: [0.16, 1, 0.3, 1],
};

// ----------------------------------------------------------------
// BOOT
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
  if (state.setupComplete && state.activeDogId) {
    try { await loadDogProfile(state.activeDogId); }
    catch (err) { console.warn('[App] Dog load failed:', err.message); }
  }

  await runRecoveryCheck();
  startLoop();
  return getState();
}

// ----------------------------------------------------------------
// ROOT
// ----------------------------------------------------------------
export default function App() {
  const [ready, setReady] = useState(false);
  const [route, setRoute] = useState(ROUTES.HOME);
  const [bootError, setBootError] = useState(null);
  const [emotion, setEmotion] = useState(EMOTION.NEUTRAL);
  const [emotionIntensity, setEmotionIntensity] = useState(0.5);
  const [splashFaded, setSplashFaded] = useState(false);
  const booted = useRef(false);

  useEffect(() => {
    if (booted.current) return;
    booted.current = true;
    boot()
      .then(state => {
        const initial = state.setupComplete ? (state.currentRoute || ROUTES.HOME) : ROUTES.SETUP;
        setRoute(initial);
        setEmotion(state.currentEmotion || EMOTION.NEUTRAL);
        setEmotionIntensity(state.emotionIntensity ?? 0.5);
        // Small delay — cinematic breathing room before reveal
        setTimeout(() => { setReady(true); setTimeout(() => setSplashFaded(true), 300); }, 400);
      })
      .catch(err => {
        console.error('[App] Boot failed:', err);
        setBootError(err.message);
        setReady(true);
        setSplashFaded(true);
      });
  }, []);

  useEffect(() => {
    if (!ready) return;
    const off = onRouteChange(newRoute => setRoute(newRoute));
    return off;
  }, [ready]);

  // Track emotion globally for AmbientWorld
  useEffect(() => {
    const off = eventBus.on(EVENT.EMOTION_CHANGED, ({ emotion: e, intensity: i }) => {
      setEmotion(e);
      setEmotionIntensity(i ?? 0.5);
    });
    return off;
  }, []);

  // ── CINEMATIC BOOT SPLASH ──
  if (!ready || !splashFaded) {
    return (
      <div style={splashStyle}>
        <AmbientWorld emotion={EMOTION.CALM} intensity={0.4} />
        <motion.div
          style={splashContentStyle}
          animate={ready ? { opacity: 0, scale: 0.95 } : { opacity: [0, 1] }}
          transition={{ duration: ready ? 0.5 : 1.2, ease: 'easeInOut' }}
        >
          <motion.div
            style={{ fontSize: 52 }}
            animate={{ scale: [1, 1.08, 1], filter: ['drop-shadow(0 0 10px rgba(201,162,39,0.4))', 'drop-shadow(0 0 30px rgba(201,162,39,0.8))', 'drop-shadow(0 0 10px rgba(201,162,39,0.4))'] }}
            transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
          >
            🐾
          </motion.div>
          <motion.span
            style={splashLogoStyle}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5, duration: 0.8 }}
          >
            IMMORTAIL™
          </motion.span>
          <motion.span
            style={splashSubStyle}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.0, duration: 0.8 }}
          >
            Your dog, forever.
          </motion.span>
        </motion.div>
      </div>
    );
  }

  // ── BOOT ERROR ──
  if (bootError) {
    return (
      <div style={splashStyle}>
        <div style={{ textAlign: 'center', color: '#e87a7a', position: 'relative', zIndex: 1 }}>
          <div style={{ fontSize: 36, marginBottom: 12 }}>⚠</div>
          <p style={{ color: '#a0a0c0', fontSize: 14 }}>Failed to start: {bootError}</p>
          <button onClick={() => window.location.reload()} style={reloadBtnStyle}>Reload</button>
        </div>
      </div>
    );
  }

  const RouteComponent = ROUTE_COMPONENTS[route] || Home;
  const showNav = !HIDE_NAV.includes(route);

  return (
    <AppErrorBoundary>
      {/* AMBIENT WORLD — always present, behind everything */}
      <AmbientWorld emotion={emotion} intensity={emotionIntensity} />

      {/* ROUTE LAYER — cinematic transitions */}
      <AnimatePresence mode="wait">
        <motion.div
          key={route}
          variants={ROUTE_VARIANTS}
          initial="initial"
          animate="animate"
          exit="exit"
          transition={ROUTE_TRANSITION}
          style={{ minHeight: '100dvh', position: 'relative', zIndex: 1 }}
        >
          <RouteComponent />
        </motion.div>
      </AnimatePresence>

      {/* PERSISTENT UI */}
      {showNav && <NavBar currentRoute={route} />}
      <LoadingOverlay />
      <ToastContainer />
    </AppErrorBoundary>
  );
}

// ── STYLES ──────────────────────────────────────────────────────
const splashStyle = {
  minHeight: '100dvh',
  background: '#020208',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  position: 'relative',
  overflow: 'hidden',
};

const splashContentStyle = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: '12px',
  position: 'relative',
  zIndex: 1,
};

const splashLogoStyle = {
  fontSize: '28px',
  fontWeight: '900',
  letterSpacing: '0.18em',
  background: 'linear-gradient(105deg, #8b6914 0%, #ffd700 30%, #fffacd 50%, #ffd700 70%, #8b6914 100%)',
  backgroundSize: '200% auto',
  WebkitBackgroundClip: 'text',
  WebkitTextFillColor: 'transparent',
  backgroundClip: 'text',
};

const splashSubStyle = {
  fontSize: '11px',
  fontWeight: '600',
  letterSpacing: '0.2em',
  textTransform: 'uppercase',
  color: 'rgba(176,176,200,0.6)',
};

const reloadBtnStyle = {
  background: 'rgba(201,162,39,0.15)',
  color: '#c9a227',
  border: '1px solid rgba(201,162,39,0.3)',
  borderRadius: '10px',
  padding: '12px 24px',
  fontSize: '13px',
  fontWeight: '600',
  cursor: 'pointer',
  marginTop: '16px',
};
