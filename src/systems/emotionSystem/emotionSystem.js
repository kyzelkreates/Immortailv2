// ================================================================
// IMMORTAIL™ — EMOTION SYSTEM
// Tracks emotional state, logs it, drives animation responses.
// All emotion mutations go through here — never directly.
// ================================================================

import { EMOTION, STORE, TASK_TYPE } from '@/core/constants.js';
import { setEmotion, getState } from '@/core/storage.js';
import { eventBus } from '@/core/eventBus.js';
import { EVENT } from '@/core/constants.js';
import { setTargetEmotion } from '@/core/animationEngine.js';
import { dbPut, dbGetAllByIndex } from '@/storage/indexedDb.js';
import { queue } from '@/core/taskEngine.js';

// ----------------------------------------------------------------
// SET EMOTION (primary entry point)
// ----------------------------------------------------------------
export function applyEmotion(emotion, intensity = 0.5, dogId = null, reason = null) {
  if (!Object.values(EMOTION).includes(emotion)) {
    console.warn(`[EmotionSystem] Unknown emotion: ${emotion}`);
    emotion = EMOTION.NEUTRAL;
  }
  intensity = Math.max(0, Math.min(1, intensity));

  setEmotion(emotion, intensity);
  setTargetEmotion(emotion, intensity);

  if (dogId) {
    _logEmotion(dogId, emotion, intensity, reason).catch(err =>
      console.warn('[EmotionSystem] Log failed:', err.message)
    );
  }
}

// ----------------------------------------------------------------
// DERIVE EMOTION FROM INTERACTION
// ----------------------------------------------------------------
export function deriveEmotionFromInteraction(interactionType) {
  switch (interactionType) {
    case 'pet':     return { emotion: EMOTION.HAPPY,   intensity: 0.8 };
    case 'play':    return { emotion: EMOTION.PLAYFUL,  intensity: 0.9 };
    case 'talk':    return { emotion: EMOTION.LOVING,   intensity: 0.7 };
    case 'memory':  return { emotion: EMOTION.CALM,     intensity: 0.6 };
    case 'miss':    return { emotion: EMOTION.MISSING,  intensity: 0.8 };
    case 'morning': return { emotion: EMOTION.HAPPY,    intensity: 0.7 };
    case 'night':   return { emotion: EMOTION.SLEEPY,   intensity: 0.7 };
    default:        return { emotion: EMOTION.NEUTRAL,  intensity: 0.5 };
  }
}

// ----------------------------------------------------------------
// GET EMOTION LOG FOR DOG
// ----------------------------------------------------------------
export async function getEmotionLog(dogId, limit = 50) {
  const all = await dbGetAllByIndex(STORE.EMOTION_LOG, 'dogId', dogId);
  return all.sort((a, b) => b.ts - a.ts).slice(0, limit);
}

// ----------------------------------------------------------------
// PRIVATE: LOG EMOTION
// ----------------------------------------------------------------
async function _logEmotion(dogId, emotion, intensity, reason) {
  await dbPut(STORE.EMOTION_LOG, {
    dogId,
    emotion,
    intensity,
    reason: reason || null,
    ts: Date.now(),
  });
}
