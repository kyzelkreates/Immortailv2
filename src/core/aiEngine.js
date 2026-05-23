// ================================================================
// IMMORTAIL™ — AI ENGINE
// Stable foundation for AI orchestration.
// UI → TaskEngine → AiEngine → Worker → Model Connector
// Never called directly from components.
// ================================================================

import { eventBus } from './eventBus.js';
import { EVENT, AI_PROVIDER, TASK_TYPE } from './constants.js';
import { getAiSettings, setAiReady } from './storage.js';
import { queue } from './taskEngine.js';

let _worker = null;
let _workerReady = false;
let _pendingCallbacks = new Map();
let _msgCounter = 0;

// ----------------------------------------------------------------
// INIT WORKER
// ----------------------------------------------------------------
export function initAiEngine() {
  try {
    _worker = new Worker(new URL('@/workers/ai.worker.js', import.meta.url), { type: 'module' });
    _worker.onmessage = _handleWorkerMessage;
    _worker.onerror = (err) => {
      console.error('[AiEngine] Worker error:', err);
      _workerReady = false;
      setAiReady(false);
    };
  } catch (err) {
    console.warn('[AiEngine] Web Worker not available, falling back to main thread mode:', err.message);
    _worker = null;
  }
}

function _handleWorkerMessage(event) {
  const { type, id, payload, error } = event.data;

  if (type === 'ready') {
    _workerReady = true;
    return;
  }

  if (type === 'response' || type === 'error') {
    const cb = _pendingCallbacks.get(id);
    if (!cb) return;
    _pendingCallbacks.delete(id);
    if (type === 'error') {
      cb.reject(new Error(error));
    } else {
      cb.resolve(payload);
    }
    return;
  }

  if (type === 'progress') {
    eventBus.emit(EVENT.TASK_PROGRESS, { id, progress: payload.progress, message: payload.message });
  }
}

// ----------------------------------------------------------------
// PROVIDER SETUP
// ----------------------------------------------------------------
export async function setupAiProvider() {
  return queue(
    TASK_TYPE.AI_SETUP,
    'Setting up AI provider',
    async ({ progress }) => {
      const settings = getAiSettings();
      progress(20);

      if (settings.provider === AI_PROVIDER.NONE) {
        setAiReady(false);
        return { ready: false, reason: 'No provider configured' };
      }

      progress(50);

      // Validate connectivity
      const ok = await _testProvider(settings);
      progress(90);

      setAiReady(ok);
      if (ok) {
        // Send config to worker
        if (_worker) {
          _postToWorker('configure', { settings });
        }
      }

      progress(100);
      return { ready: ok, provider: settings.provider };
    },
    { singleton: true }
  );
}

async function _testProvider(settings) {
  try {
    if (settings.provider === AI_PROVIDER.OLLAMA) {
      const url = (settings.ollamaUrl || 'http://localhost:11434').replace(/\/$/, '');
      const res = await fetch(`${url}/api/tags`, { signal: AbortSignal.timeout(5000) });
      return res.ok;
    }
    if (settings.provider === AI_PROVIDER.OPENAI_COMPAT) {
      if (!settings.openaiCompatUrl || !settings.openaiCompatKey) return false;
      const res = await fetch(`${settings.openaiCompatUrl}/models`, {
        headers: { Authorization: `Bearer ${settings.openaiCompatKey}` },
        signal: AbortSignal.timeout(5000)
      });
      return res.ok;
    }
    if (settings.provider === AI_PROVIDER.CUSTOM) {
      if (!settings.customUrl) return false;
      let headers = {};
      try { headers = JSON.parse(settings.customHeaders || '{}'); } catch {}
      const res = await fetch(settings.customUrl, { method: 'GET', headers, signal: AbortSignal.timeout(5000) });
      return res.ok || res.status < 500;
    }
    return false;
  } catch {
    return false;
  }
}

// ----------------------------------------------------------------
// INFERENCE
// ----------------------------------------------------------------
export async function runInference(prompt, context = []) {
  return queue(
    TASK_TYPE.AI_INFERENCE,
    'Thinking…',
    async ({ progress, cancel }) => {
      const settings = getAiSettings();
      progress(10);
      cancel.throw();

      if (settings.provider === AI_PROVIDER.NONE) {
        return { text: _localFallbackResponse(prompt), local: true };
      }

      progress(30);

      if (_worker && _workerReady) {
        return _runInWorker('infer', { prompt, context, settings });
      }

      // Main thread fallback
      return _runInferenceMainThread(prompt, context, settings, progress);
    },
    { maxRetries: 1 }
  );
}

async function _runInferenceMainThread(prompt, context, settings, progress) {
  progress(50);
  const messages = [
    { role: 'system', content: settings.systemPrompt || 'You are a warm, emotionally intelligent companion.' },
    ...context,
    { role: 'user', content: prompt }
  ];

  let url, headers, body;

  if (settings.provider === AI_PROVIDER.OLLAMA) {
    const base = (settings.ollamaUrl || 'http://localhost:11434').replace(/\/$/, '');
    url = `${base}/api/chat`;
    headers = { 'Content-Type': 'application/json' };
    body = JSON.stringify({ model: settings.ollamaModel, messages, stream: false, options: { temperature: settings.temperature } });
  } else if (settings.provider === AI_PROVIDER.OPENAI_COMPAT) {
    url = `${settings.openaiCompatUrl}/chat/completions`;
    headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${settings.openaiCompatKey}` };
    body = JSON.stringify({ model: settings.openaiCompatModel, messages, temperature: settings.temperature, max_tokens: settings.maxTokens });
  } else if (settings.provider === AI_PROVIDER.CUSTOM) {
    url = settings.customUrl;
    try { headers = { 'Content-Type': 'application/json', ...JSON.parse(settings.customHeaders || '{}') }; } catch { headers = { 'Content-Type': 'application/json' }; }
    body = JSON.stringify({ model: settings.customModel, messages });
  }

  progress(70);
  const res = await fetch(url, { method: 'POST', headers, body, signal: AbortSignal.timeout(25000) });
  if (!res.ok) throw new Error(`AI request failed: ${res.status}`);
  const data = await res.json();
  progress(100);

  // Normalize response across providers
  const text = data.message?.content || data.choices?.[0]?.message?.content || data.response || '';
  eventBus.emit(EVENT.AI_RESPONSE, { text, provider: settings.provider });
  return { text, provider: settings.provider };
}

function _localFallbackResponse(prompt) {
  const lc = prompt.toLowerCase();
  if (lc.includes('miss') || lc.includes('sad')) return 'They were so loved. They still are.';
  if (lc.includes('happy') || lc.includes('fun')) return 'Every moment with them mattered.';
  if (lc.includes('play')) return 'They always knew how to make you smile.';
  return 'They are still here, in every memory you hold.';
}

// ----------------------------------------------------------------
// WORKER COMMUNICATION
// ----------------------------------------------------------------
function _runInWorker(type, payload) {
  return new Promise((resolve, reject) => {
    const id = ++_msgCounter;
    _pendingCallbacks.set(id, { resolve, reject });
    _worker.postMessage({ type, id, payload });
    setTimeout(() => {
      if (_pendingCallbacks.has(id)) {
        _pendingCallbacks.delete(id);
        reject(new Error('Worker inference timeout'));
      }
    }, 25000);
  });
}

function _postToWorker(type, payload) {
  if (_worker) _worker.postMessage({ type, payload });
}
