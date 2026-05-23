// ================================================================
// IMMORTAIL™ — CONSTANTS
// Single source of truth for all system-wide constants
// ================================================================

export const APP_VERSION = '1.0.0';
export const DB_NAME = 'immortail_db';
export const DB_VERSION = 1;

// ----------------------------------------------------------------
// ROUTE KEYS
// ----------------------------------------------------------------
export const ROUTES = {
  SETUP: '/setup',
  HOME: '/',
  MY_DOG: '/my-dog',
  MEMORIES: '/memories',
  SETTINGS: '/settings',
};

// ----------------------------------------------------------------
// TASK STATUS
// ----------------------------------------------------------------
export const TASK_STATUS = {
  PENDING: 'pending',
  RUNNING: 'running',
  COMPLETE: 'complete',
  FAILED: 'failed',
  CANCELLED: 'cancelled',
  TIMEOUT: 'timeout',
};

// ----------------------------------------------------------------
// TASK TYPES
// ----------------------------------------------------------------
export const TASK_TYPE = {
  DOG_LOAD: 'dog_load',
  DOG_SAVE: 'dog_save',
  MEMORY_LOAD: 'memory_load',
  MEMORY_SAVE: 'memory_save',
  MEDIA_INGEST: 'media_ingest',
  MEDIA_PROCESS: 'media_process',
  AI_INFERENCE: 'ai_inference',
  AI_SETUP: 'ai_setup',
  SETUP_COMPLETE: 'setup_complete',
  ROUTE_TRANSITION: 'route_transition',
  STATE_RESTORE: 'state_restore',
  EMOTION_UPDATE: 'emotion_update',
  SETTINGS_SAVE: 'settings_save',
};

// ----------------------------------------------------------------
// TASK TIMEOUTS (ms)
// ----------------------------------------------------------------
export const TASK_TIMEOUT = {
  [TASK_TYPE.DOG_LOAD]: 10000,
  [TASK_TYPE.DOG_SAVE]: 8000,
  [TASK_TYPE.MEMORY_LOAD]: 15000,
  [TASK_TYPE.MEMORY_SAVE]: 10000,
  [TASK_TYPE.MEDIA_INGEST]: 60000,
  [TASK_TYPE.MEDIA_PROCESS]: 120000,
  [TASK_TYPE.AI_INFERENCE]: 30000,
  [TASK_TYPE.AI_SETUP]: 20000,
  [TASK_TYPE.SETUP_COMPLETE]: 15000,
  [TASK_TYPE.ROUTE_TRANSITION]: 5000,
  [TASK_TYPE.STATE_RESTORE]: 10000,
  [TASK_TYPE.EMOTION_UPDATE]: 3000,
  [TASK_TYPE.SETTINGS_SAVE]: 5000,
};

// ----------------------------------------------------------------
// EMOTION STATES
// ----------------------------------------------------------------
export const EMOTION = {
  NEUTRAL: 'neutral',
  HAPPY: 'happy',
  PLAYFUL: 'playful',
  CALM: 'calm',
  SLEEPY: 'sleepy',
  EXCITED: 'excited',
  LOVING: 'loving',
  CURIOUS: 'curious',
  MISSING: 'missing',
};

// ----------------------------------------------------------------
// EMOTION COLORS (used by animation engine)
// ----------------------------------------------------------------
export const EMOTION_COLOR = {
  [EMOTION.NEUTRAL]:  '#8b9db8',
  [EMOTION.HAPPY]:    '#f5c842',
  [EMOTION.PLAYFUL]:  '#f0914a',
  [EMOTION.CALM]:     '#6eb5c0',
  [EMOTION.SLEEPY]:   '#8a7aab',
  [EMOTION.EXCITED]:  '#e84393',
  [EMOTION.LOVING]:   '#e87c8a',
  [EMOTION.CURIOUS]:  '#7ac47a',
  [EMOTION.MISSING]:  '#5577aa',
};

// ----------------------------------------------------------------
// AI PROVIDER TYPES
// ----------------------------------------------------------------
export const AI_PROVIDER = {
  NONE: 'none',
  OLLAMA: 'ollama',
  OPENAI_COMPAT: 'openai_compat',
  CUSTOM: 'custom',
};

// ----------------------------------------------------------------
// EVENT BUS EVENTS
// ----------------------------------------------------------------
export const EVENT = {
  ROUTE_CHANGE: 'route:change',
  ROUTE_READY: 'route:ready',
  TASK_START: 'task:start',
  TASK_PROGRESS: 'task:progress',
  TASK_COMPLETE: 'task:complete',
  TASK_FAILED: 'task:failed',
  TASK_CANCELLED: 'task:cancelled',
  STATE_CHANGE: 'state:change',
  DOG_LOADED: 'dog:loaded',
  DOG_SAVED: 'dog:saved',
  MEMORY_LOADED: 'memory:loaded',
  MEMORY_SAVED: 'memory:saved',
  MEDIA_INGESTED: 'media:ingested',
  EMOTION_CHANGED: 'emotion:changed',
  AI_READY: 'ai:ready',
  AI_RESPONSE: 'ai:response',
  SETUP_COMPLETE: 'setup:complete',
  ERROR: 'system:error',
  RECOVERY_START: 'recovery:start',
  RECOVERY_COMPLETE: 'recovery:complete',
  LOADING_SHOW: 'loading:show',
  LOADING_HIDE: 'loading:hide',
  ANIMATION_PAUSE: 'animation:pause',
  ANIMATION_RESUME: 'animation:resume',
};

// ----------------------------------------------------------------
// STORAGE KEYS (IndexedDB stores)
// ----------------------------------------------------------------
export const STORE = {
  APP_STATE: 'app_state',
  DOG_PROFILES: 'dog_profiles',
  MEMORIES: 'memories',
  MEDIA: 'media',
  AI_SETTINGS: 'ai_settings',
  SETTINGS: 'settings',
  EMOTION_LOG: 'emotion_log',
};

// ----------------------------------------------------------------
// ANIMATION CONSTANTS
// ----------------------------------------------------------------
export const ANIM = {
  TARGET_FPS: 60,
  FALLBACK_FPS: 30,
  FRAME_BUDGET_MS: 16.67,
  REDUCED_MOTION_FPS: 24,
  IDLE_BREATH_SPEED: 0.0008,
  IDLE_FLOAT_SPEED: 0.0004,
  TRANSITION_DURATION: 400,
  EMOTION_BLEND_SPEED: 0.03,
};

// ----------------------------------------------------------------
// MEDIA TYPES
// ----------------------------------------------------------------
export const MEDIA_TYPE = {
  IMAGE: 'image',
  VIDEO: 'video',
  AUDIO: 'audio',
};

export const ACCEPTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
export const ACCEPTED_VIDEO_TYPES = ['video/mp4', 'video/webm', 'video/quicktime'];
export const ACCEPTED_AUDIO_TYPES = ['audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/m4a', 'audio/mp4'];

export const MAX_MEDIA_SIZE_BYTES = 100 * 1024 * 1024; // 100MB per file
