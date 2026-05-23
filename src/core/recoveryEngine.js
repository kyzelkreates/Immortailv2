// ================================================================
// IMMORTAIL™ — RECOVERY ENGINE
// Detects and recovers from corrupted or inconsistent state.
// ================================================================

import { eventBus } from './eventBus.js';
import { EVENT, ROUTES } from './constants.js';
import { getState, setSetupComplete, setActiveDogId, setActiveDog, updateSettings } from './storage.js';
import { dbHealthCheck } from '@/storage/indexedDb.js';
import { dbGetAll } from '@/storage/indexedDb.js';
import { STORE } from './constants.js';
import { replace } from './router.js';

export async function runRecoveryCheck() {
  eventBus.emit(EVENT.RECOVERY_START, {});

  const issues = [];

  // 1. Check DB health
  const dbHealth = await dbHealthCheck();
  if (!dbHealth.ok) {
    issues.push(`Missing DB stores: ${dbHealth.missing?.join(', ')}`);
  }

  // 2. Check state consistency
  const state = getState();
  if (state.setupComplete && !state.activeDogId) {
    console.warn('[Recovery] Setup complete but no activeDogId — checking for profiles');
    try {
      const profiles = await dbGetAll(STORE.DOG_PROFILES);
      if (profiles && profiles.length > 0) {
        const dog = profiles[0];
        await setActiveDogId(dog.id);
        setActiveDog(dog);
        issues.push('Recovered: missing activeDogId restored from profiles');
      } else {
        // No profiles found — reset setup
        await setSetupComplete(false);
        await setActiveDogId(null);
        setActiveDog(null);
        replace(ROUTES.SETUP);
        issues.push('Recovery: no dog profiles found, reset to setup');
      }
    } catch (err) {
      console.error('[Recovery] Failed to recover dog profile:', err);
      issues.push(`Recovery error: ${err.message}`);
    }
  }

  // 3. Check for stuck route
  if (state.currentRoute === ROUTES.SETUP && state.setupComplete) {
    replace(ROUTES.HOME);
    issues.push('Recovery: route stuck on /setup despite setup being complete');
  }

  if (issues.length > 0) {
    console.info('[Recovery] Issues resolved:', issues);
  }

  eventBus.emit(EVENT.RECOVERY_COMPLETE, { issues });
  return issues;
}
