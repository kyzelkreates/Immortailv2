// ================================================================
// IMMORTAIL™ — AI WORKER
// Runs AI inference off the main thread.
// Receives config + prompt, returns response.
// ================================================================

let _settings = null;

self.onmessage = async (event) => {
  const { type, id, payload } = event.data;

  if (type === 'configure') {
    _settings = payload.settings;
    self.postMessage({ type: 'ready' });
    return;
  }

  if (type === 'infer') {
    try {
      const result = await _runInference(payload.prompt, payload.context, payload.settings || _settings, id);
      self.postMessage({ type: 'response', id, payload: result });
    } catch (err) {
      self.postMessage({ type: 'error', id, error: err.message });
    }
    return;
  }
};

async function _runInference(prompt, context = [], settings, taskId) {
  if (!settings) throw new Error('No AI settings configured');

  const messages = [
    { role: 'system', content: settings.systemPrompt || 'You are a warm, emotionally intelligent companion.' },
    ...(context || []),
    { role: 'user', content: prompt }
  ];

  let url, headers, body;

  if (settings.provider === 'ollama') {
    const base = (settings.ollamaUrl || 'http://localhost:11434').replace(/\/$/, '');
    url = `${base}/api/chat`;
    headers = { 'Content-Type': 'application/json' };
    body = JSON.stringify({ model: settings.ollamaModel, messages, stream: false, options: { temperature: settings.temperature ?? 0.7 } });

  } else if (settings.provider === 'openai_compat') {
    url = `${settings.openaiCompatUrl}/chat/completions`;
    headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${settings.openaiCompatKey}` };
    body = JSON.stringify({ model: settings.openaiCompatModel, messages, temperature: settings.temperature ?? 0.7, max_tokens: settings.maxTokens ?? 500 });

  } else if (settings.provider === 'custom') {
    url = settings.customUrl;
    let extraHeaders = {};
    try { extraHeaders = JSON.parse(settings.customHeaders || '{}'); } catch {}
    headers = { 'Content-Type': 'application/json', ...extraHeaders };
    body = JSON.stringify({ model: settings.customModel, messages });

  } else {
    throw new Error(`Unknown provider: ${settings.provider}`);
  }

  self.postMessage({ type: 'progress', id: taskId, payload: { progress: 50, message: 'Waiting for response…' } });

  const res = await fetch(url, { method: 'POST', headers, body });
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text().catch(() => 'unknown error')}`);

  const data = await res.json();
  const text = data.message?.content || data.choices?.[0]?.message?.content || data.response || '';

  self.postMessage({ type: 'progress', id: taskId, payload: { progress: 95, message: 'Processing response…' } });

  return { text, provider: settings.provider };
}
