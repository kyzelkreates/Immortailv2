// ================================================================
// IMMORTAIL™ — DOG SYSTEM
// Manages dog profiles: create, load, save, update.
// All ops route through taskEngine.
// ================================================================

import { queue } from '@/core/taskEngine.js';
import { TASK_TYPE } from '@/core/constants.js';
import { setActiveDog, setActiveDogId, setEmotion } from '@/core/storage.js';
import { eventBus } from '@/core/eventBus.js';
import { EVENT, EMOTION, STORE } from '@/core/constants.js';
import { dbGetAll, dbPut, dbGet, dbDelete, dbGetAllByIndex } from '@/storage/indexedDb.js';
import { saveMedia, getMediaByDog } from '@/storage/indexedDb.js';

// ----------------------------------------------------------------
// CREATE DOG PROFILE
// ----------------------------------------------------------------
export async function createDogProfile(profileData) {
  return queue(
    TASK_TYPE.DOG_SAVE,
    `Creating profile for ${profileData.name}`,
    async ({ progress }) => {
      progress(10);
      const now = Date.now();
      const dog = {
        name: profileData.name,
        breed: profileData.breed || '',
        birthDate: profileData.birthDate || null,
        passedDate: profileData.passedDate || null,
        bio: profileData.bio || '',
        personality: profileData.personality || [],
        coverMediaId: null,
        avatarMediaId: null,
        emotion: EMOTION.NEUTRAL,
        emotionIntensity: 0.5,
        interactionCount: 0,
        lastInteraction: now,
        createdAt: now,
        updatedAt: now,
      };

      progress(50);
      const id = await dbPut(STORE.DOG_PROFILES, dog);
      const savedDog = { ...dog, id };
      progress(90);

      await setActiveDogId(id);
      setActiveDog(savedDog);
      setEmotion(EMOTION.LOVING, 0.8);

      progress(100);
      eventBus.emit(EVENT.DOG_SAVED, { dog: savedDog });
      return savedDog;
    },
    { showLoading: true }
  );
}

// ----------------------------------------------------------------
// LOAD DOG PROFILE
// ----------------------------------------------------------------
export async function loadDogProfile(dogId) {
  return queue(
    TASK_TYPE.DOG_LOAD,
    'Loading your companion…',
    async ({ progress }) => {
      progress(20);
      const dog = await dbGet(STORE.DOG_PROFILES, dogId);
      if (!dog) throw new Error(`Dog profile ${dogId} not found`);
      progress(60);
      setActiveDog(dog);
      setEmotion(dog.emotion || EMOTION.NEUTRAL, dog.emotionIntensity || 0.5);
      progress(100);
      return dog;
    },
    { showLoading: true, singleton: true }
  );
}

// ----------------------------------------------------------------
// UPDATE DOG PROFILE
// ----------------------------------------------------------------
export async function updateDogProfile(dogId, updates) {
  return queue(
    TASK_TYPE.DOG_SAVE,
    'Saving profile…',
    async ({ progress }) => {
      progress(20);
      const existing = await dbGet(STORE.DOG_PROFILES, dogId);
      if (!existing) throw new Error('Dog profile not found');
      const updated = { ...existing, ...updates, updatedAt: Date.now() };
      progress(60);
      await dbPut(STORE.DOG_PROFILES, updated);
      setActiveDog(updated);
      progress(100);
      eventBus.emit(EVENT.DOG_SAVED, { dog: updated });
      return updated;
    }
  );
}

// ----------------------------------------------------------------
// GET ALL DOG PROFILES
// ----------------------------------------------------------------
export async function getAllDogProfiles() {
  return dbGetAll(STORE.DOG_PROFILES);
}

// ----------------------------------------------------------------
// DELETE DOG PROFILE
// ----------------------------------------------------------------
export async function deleteDogProfile(dogId) {
  return queue(
    TASK_TYPE.DOG_SAVE,
    'Removing profile…',
    async ({ progress }) => {
      progress(20);
      await dbDelete(STORE.DOG_PROFILES, dogId);
      progress(70);
      // Also remove all media for this dog
      const media = await getMediaByDog(dogId);
      for (const m of media) {
        await dbDelete(STORE.MEDIA, m.id);
      }
      progress(100);
      return { deleted: true, dogId };
    },
    { showLoading: true }
  );
}

// ----------------------------------------------------------------
// INCREMENT INTERACTION
// ----------------------------------------------------------------
export async function recordInteraction(dogId) {
  try {
    const dog = await dbGet(STORE.DOG_PROFILES, dogId);
    if (!dog) return;
    await dbPut(STORE.DOG_PROFILES, {
      ...dog,
      interactionCount: (dog.interactionCount || 0) + 1,
      lastInteraction: Date.now(),
      updatedAt: Date.now(),
    });
  } catch (err) {
    console.warn('[DogSystem] recordInteraction failed:', err.message);
  }
}
