// ================================================================
// IMMORTAIL™ — ANIMATION ENGINE
// Single centralized RAF loop. All animations register here.
// Never owns app state. Never triggers tasks directly.
// ================================================================

import { eventBus } from './eventBus.js';
import { EVENT, ANIM, EMOTION_COLOR, EMOTION } from './constants.js';

let _rafId = null;
let _running = false;
let _lastTime = 0;
let _frameCount = 0;
let _fps = 60;
let _reducedMotion = false;
let _paused = false;
let _animationMap = new Map(); // id → animation object
let _aniCounter = 0;

// ----------------------------------------------------------------
// INIT
// ----------------------------------------------------------------
export function initAnimationEngine() {
  _reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  window.matchMedia('(prefers-reduced-motion: reduce)').addEventListener('change', e => {
    _reducedMotion = e.matches;
  });

  // Pause when tab hidden, resume when visible
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      _paused = true;
      eventBus.emit(EVENT.ANIMATION_PAUSE, {});
    } else {
      _paused = false;
      _lastTime = 0;
      eventBus.emit(EVENT.ANIMATION_RESUME, {});
      if (_running && !_rafId) _tick(performance.now());
    }
  });

  // Listen for explicit pause/resume events
  eventBus.on(EVENT.ANIMATION_PAUSE, () => { _paused = true; });
  eventBus.on(EVENT.ANIMATION_RESUME, () => {
    _paused = false;
    _lastTime = 0;
    if (_running && !_rafId) _loop();
  });
}

// ----------------------------------------------------------------
// LOOP
// ----------------------------------------------------------------
export function startLoop() {
  if (_running) return;
  _running = true;
  _lastTime = 0;
  _loop();
}

export function stopLoop() {
  _running = false;
  if (_rafId) {
    cancelAnimationFrame(_rafId);
    _rafId = null;
  }
}

function _loop() {
  if (!_running) return;
  _rafId = requestAnimationFrame(_tick);
}

function _tick(now) {
  _rafId = null;
  if (!_running || _paused) return;

  if (_lastTime === 0) _lastTime = now;
  const dt = Math.min(now - _lastTime, 100); // cap delta to 100ms (tab resume safety)
  _lastTime = now;

  // FPS tracking
  _frameCount++;
  const targetInterval = _reducedMotion
    ? 1000 / ANIM.REDUCED_MOTION_FPS
    : 1000 / ANIM.TARGET_FPS;

  // Run all registered animations
  for (const [id, anim] of _animationMap) {
    if (anim.paused || anim.done) continue;
    try {
      anim.elapsed += dt;
      const keep = anim.fn(dt, anim.elapsed, _reducedMotion);
      if (keep === false) {
        _animationMap.delete(id);
      }
    } catch (err) {
      console.error(`[AnimationEngine] Animation "${id}" error:`, err);
      _animationMap.delete(id);
    }
  }

  _loop();
}

// ----------------------------------------------------------------
// REGISTER / UNREGISTER ANIMATIONS
// ----------------------------------------------------------------

/**
 * Register an animation.
 * @param {string} id - unique identifier
 * @param {function} fn - called each frame: fn(dt, elapsed, reducedMotion) → return false to remove
 * @param {object} options - { priority: 0, group: null }
 */
export function registerAnimation(id, fn, options = {}) {
  _animationMap.set(id, {
    id,
    fn,
    elapsed: 0,
    paused: false,
    done: false,
    priority: options.priority ?? 0,
    group: options.group ?? null,
  });
}

export function unregisterAnimation(id) {
  _animationMap.delete(id);
}

export function pauseAnimation(id) {
  const a = _animationMap.get(id);
  if (a) a.paused = true;
}

export function resumeAnimation(id) {
  const a = _animationMap.get(id);
  if (a) a.paused = false;
}

export function clearGroup(group) {
  for (const [id, anim] of _animationMap) {
    if (anim.group === group) _animationMap.delete(id);
  }
}

export function clearAll() {
  _animationMap.clear();
}

// ----------------------------------------------------------------
// EMOTIONAL PRESENCE SYSTEM
// Manages the ambient glow/breathe animation for the dog orb.
// Updates a shared ref — never React state.
// ----------------------------------------------------------------

const _emotionState = {
  currentColor: EMOTION_COLOR[EMOTION.NEUTRAL],
  targetColor: EMOTION_COLOR[EMOTION.NEUTRAL],
  breathePhase: 0,
  floatPhase: 0,
  intensity: 0.5,
  blendT: 1,
};

export function getEmotionState() {
  return { ..._emotionState };
}

export function setTargetEmotion(emotion, intensity = 0.5) {
  _emotionState.targetColor = EMOTION_COLOR[emotion] || EMOTION_COLOR[EMOTION.NEUTRAL];
  _emotionState.intensity = Math.max(0, Math.min(1, intensity));
  _emotionState.blendT = 0;
}

export function registerEmotionAnimation(canvasRef) {
  registerAnimation('emotion_presence', (dt, elapsed, reduced) => {
    if (!canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Blend toward target color
    if (_emotionState.blendT < 1) {
      _emotionState.blendT = Math.min(1, _emotionState.blendT + ANIM.EMOTION_BLEND_SPEED);
      _emotionState.currentColor = lerpColor(
        _emotionState.currentColor,
        _emotionState.targetColor,
        _emotionState.blendT
      );
    }

    // Breathe + float phase
    const breatheSpeed = reduced ? ANIM.IDLE_BREATH_SPEED * 0.5 : ANIM.IDLE_BREATH_SPEED;
    const floatSpeed = reduced ? ANIM.IDLE_FLOAT_SPEED * 0.5 : ANIM.IDLE_FLOAT_SPEED;
    _emotionState.breathePhase += dt * breatheSpeed;
    _emotionState.floatPhase += dt * floatSpeed;

    const breathe = 0.85 + 0.15 * Math.sin(_emotionState.breathePhase * Math.PI * 2);
    const floatY = Math.sin(_emotionState.floatPhase * Math.PI * 2) * 6;

    _drawPresence(ctx, canvas.width, canvas.height, breathe, floatY, _emotionState.currentColor, _emotionState.intensity);
  }, { group: 'presence' });
}

function _drawPresence(ctx, w, h, breathe, floatY, color, intensity) {
  ctx.clearRect(0, 0, w, h);

  const cx = w / 2;
  const cy = h / 2 + floatY;
  const radius = Math.min(w, h) * 0.35 * breathe;

  // Outer glow
  const glow = ctx.createRadialGradient(cx, cy, radius * 0.3, cx, cy, radius * 1.8);
  glow.addColorStop(0, hexToRgba(color, 0.18 * intensity));
  glow.addColorStop(1, hexToRgba(color, 0));
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(cx, cy, radius * 1.8, 0, Math.PI * 2);
  ctx.fill();

  // Core orb gradient
  const orb = ctx.createRadialGradient(cx - radius * 0.2, cy - radius * 0.2, 0, cx, cy, radius);
  orb.addColorStop(0, hexToRgba(color, 0.55 * intensity));
  orb.addColorStop(0.6, hexToRgba(color, 0.25 * intensity));
  orb.addColorStop(1, hexToRgba(color, 0.05));
  ctx.fillStyle = orb;
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.fill();
}

// ----------------------------------------------------------------
// IMAGE LAYER ANIMATION
// Renders uploaded dog images as layered, breathing presence
// ----------------------------------------------------------------
export function registerDogImageAnimation(canvasRef, imageUrl, emotionRef) {
  let img = null;
  let loaded = false;

  if (imageUrl) {
    img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => { loaded = true; };
    img.onerror = () => { loaded = false; };
    img.src = imageUrl;
  }

  registerAnimation('dog_image', (dt, elapsed, reduced) => {
    if (!canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx || !loaded || !img) return;

    const w = canvas.width;
    const h = canvas.height;
    const cx = w / 2;
    const cy = h / 2;

    const breathe = _emotionState ? (0.97 + 0.03 * Math.sin(_emotionState.breathePhase * Math.PI * 2)) : 1;
    const floatY = _emotionState ? (Math.sin(_emotionState.floatPhase * Math.PI * 2) * 4) : 0;

    const drawW = Math.min(w * 0.8, h * 0.75) * breathe;
    const drawH = drawW * (img.naturalHeight / img.naturalWidth);

    ctx.save();
    ctx.globalAlpha = 0.95;
    ctx.drawImage(img, cx - drawW / 2, cy - drawH / 2 + floatY, drawW, drawH);
    ctx.restore();
  }, { group: 'dog_layer', priority: 1 });
}

// ----------------------------------------------------------------
// COLOR UTILS
// ----------------------------------------------------------------
function hexToRgba(hex, alpha) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

function lerpColor(from, to, t) {
  const f = hexToComponents(from);
  const e = hexToComponents(to);
  const r = Math.round(f[0] + (e[0] - f[0]) * t);
  const g = Math.round(f[1] + (e[1] - f[1]) * t);
  const b = Math.round(f[2] + (e[2] - f[2]) * t);
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

function hexToComponents(hex) {
  return [
    parseInt(hex.slice(1, 3), 16),
    parseInt(hex.slice(3, 5), 16),
    parseInt(hex.slice(5, 7), 16),
  ];
}
