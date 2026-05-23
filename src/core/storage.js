// ================================================================
// IMMORTAIL™ — STORAGE (SINGLE SOURCE OF TRUTH)
// All application state lives here and is backed by IndexedDB.
// No component may own critical state independently.
// ================================================================

import { eventBus } from './eventBus.js';
import { EVENT, EMOTION, ROUTES, AI_PROVIDER } from './constants.js';
import {
  getAppState, setAppState,
  getSetting, setSetting, getAllSettings,
  getAiSetting, setAiSetting, getAllAiSettings,
  dbGetAll, dbPut, dbDelete
} from '@/storage/indexedDb.js';
import { STORE } from './constants.js';

// ----------------------------------------------------------------
// IN-MEMORY STATE SNAPSHOT
// Never mutate directly — use the setters below.
// ----------------------------------------------------------------
let _state = {
  // App lifecycle
  initialized: false,
  setupComplete: false,
  currentRoute: ROUTES.HOME,

  // Active dog profile
  activeDogId: null,
  activeDog: null,

  // Emotion
  currentEmotion: EMOTION.NEUTRAL,
  emotionIntensity: 0.5,

  // AI
  aiProvider: AI_PROVIDER.NONE,
  aiReady: false,

  // Settings
  settings: {
    theme: 'dark',
    reducedMotion: false,
    notificationsEnabled: false,
    language: 'en',
  },

  // AI Settings
  aiSettings: {
    provider: AI_PROVIDER.NONE,
    ollamaUrl: 'http://localhost:11434',
    ollamaModel: '',
    openaiCompatUrl: '',
    openaiCompatKey: '',
    openaiCompatModel: '',
    customUrl: '',
    customHeaders: '{}',
    customModel: '',
    systemPrompt: '',
    temperature: 0.7,
    maxTokens: 500,
  },

  // Loading / task state (ephemeral, not persisted)
  loadingVisible: false,
  loadingMessage: '',
  loadingProgress: 0,
  loadingCancellable: false,

  // Error state
  lastError: null,
};

// ----------------------------------------------------------------
// INIT — restore persisted state from IndexedDB
// ----------------------------------------------------------------
export async function initStorage() {
  try {
    const setupComplete = await getAppState('setupComplete');
    const activeDogId = await getAppState('activeDogId');
    const currentRoute = await getAppState('currentRoute');

    const settings = await getAllSettings();
    const aiSettings = await getAllAiSettings();

    _state = {
      ..._state,
      initialized: true,
      setupComplete: !!setupComplete,
      activeDogId: activeDogId ?? null,
      currentRoute: currentRoute ?? (setupComplete ? ROUTES.HOME : ROUTES.SETUP),
      settings: { ..._state.settings, ...settings },
      aiSettings: { ..._state.aiSettings, ...aiSettings },
    };

    // Detect OS reduced motion preference
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      _state.settings.reducedMotion = true;
    }

    eventBus.emit(EVENT.STATE_CHANGE, { key: 'initialized', value: true });
    return _state;
  } catch (err) {
    console.error('[Storage] initStorage failed:', err);
    _state.initialized = true; // allow recovery
    _state.lastError = { message: err.message, ts: Date.now() };
    return _state;
  }
}

// ----------------------------------------------------------------
// STATE ACCESSORS
// ----------------------------------------------------------------
export function getState() {
  return { ..._state };
}

export function getActiveDog() {
  return _state.activeDog ? { ..._state.activeDog } : null;
}

export function isSetupComplete() {
  return _state.setupComplete;
}

export function getCurrentRoute() {
  return _state.currentRoute;
}

export function getCurrentEmotion() {
  return { emotion: _state.currentEmotion, intensity: _state.emotionIntensity };
}

export function getSettings() {
  return { ..._state.settings };
}

export function getAiSettings() {
  return { ..._state.aiSettings };
}

// ----------------------------------------------------------------
// STATE SETTERS (with persistence)
// ----------------------------------------------------------------

export async function setSetupComplete(value) {
  _state.setupComplete = value;
  await setAppState('setupComplete', value);
  eventBus.emit(EVENT.STATE_CHANGE, { key: 'setupComplete', value });
}

export async function setActiveDogId(dogId) {
  _state.activeDogId = dogId;
  await setAppState('activeDogId', dogId);
  eventBus.emit(EVENT.STATE_CHANGE, { key: 'activeDogId', value: dogId });
}

export function setActiveDog(dog) {
  _state.activeDog = dog ? { ...dog } : null;
  eventBus.emit(EVENT.DOG_LOADED, { dog: _state.activeDog });
  eventBus.emit(EVENT.STATE_CHANGE, { key: 'activeDog', value: _state.activeDog });
}

export async function setCurrentRoute(route) {
  _state.currentRoute = route;
  await setAppState('currentRoute', route);
  eventBus.emit(EVENT.STATE_CHANGE, { key: 'currentRoute', value: route });
}

export function setEmotion(emotion, intensity = 0.5) {
  const prev = _state.currentEmotion;
  _state.currentEmotion = emotion;
  _state.emotionIntensity = Math.max(0, Math.min(1, intensity));
  if (prev !== emotion) {
    eventBus.emit(EVENT.EMOTION_CHANGED, { emotion, intensity: _state.emotionIntensity, prev });
  }
}

export async function updateSettings(updates) {
  _state.settings = { ..._state.settings, ...updates };
  for (const [key, value] of Object.entries(updates)) {
    await setSetting(key, value);
  }
  eventBus.emit(EVENT.STATE_CHANGE, { key: 'settings', value: _state.settings });
}

export async function updateAiSettings(updates) {
  _state.aiSettings = { ..._state.aiSettings, ...updates };
  for (const [key, value] of Object.entries(updates)) {
    await setAiSetting(key, value);
  }
  eventBus.emit(EVENT.STATE_CHANGE, { key: 'aiSettings', value: _state.aiSettings });
}

export function setAiReady(ready) {
  _state.aiReady = ready;
  if (ready) eventBus.emit(EVENT.AI_READY, {});
  eventBus.emit(EVENT.STATE_CHANGE, { key: 'aiReady', value: ready });
}

export function setLastError(error) {
  _state.lastError = error ? { ...error, ts: Date.now() } : null;
  if (error) eventBus.emit(EVENT.ERROR, { error: _state.lastError });
}

// ----------------------------------------------------------------
// LOADING STATE (ephemeral, no persistence needed)
// ----------------------------------------------------------------
export function setLoading(visible, message = '', progress = 0, cancellable = false) {
  _state.loadingVisible = visible;
  _state.loadingMessage = message;
  _state.loadingProgress = progress;
  _state.loadingCancellable = cancellable;
  if (visible) {
    eventBus.emit(EVENT.LOADING_SHOW, { message, progress, cancellable });
  } else {
    eventBus.emit(EVENT.LOADING_HIDE, {});
  }
}

export function updateLoadingProgress(progress, message) {
  _state.loadingProgress = progress;
  if (message !== undefined) _state.loadingMessage = message;
  eventBus.emit(EVENT.TASK_PROGRESS, { progress, message: _state.loadingMessage });
}
