// ================================================================
// IMMORTAIL™ — EVENT BUS
// Central pub/sub system. No direct component coupling.
// All systems communicate through events only.
// ================================================================

class EventBus {
  constructor() {
    this._listeners = new Map();
    this._onceListeners = new Map();
    this._history = [];
    this._maxHistory = 100;
  }

  on(event, handler) {
    if (!this._listeners.has(event)) {
      this._listeners.set(event, new Set());
    }
    this._listeners.get(event).add(handler);
    return () => this.off(event, handler);
  }

  once(event, handler) {
    const wrapper = (data) => {
      handler(data);
      this.off(event, wrapper);
    };
    wrapper._original = handler;
    return this.on(event, wrapper);
  }

  off(event, handler) {
    const listeners = this._listeners.get(event);
    if (!listeners) return;
    for (const l of listeners) {
      if (l === handler || l._original === handler) {
        listeners.delete(l);
        break;
      }
    }
  }

  emit(event, data = {}) {
    const entry = { event, data, ts: Date.now() };
    this._history.push(entry);
    if (this._history.length > this._maxHistory) {
      this._history.shift();
    }

    const listeners = this._listeners.get(event);
    if (!listeners || listeners.size === 0) return;

    for (const handler of listeners) {
      try {
        handler(data);
      } catch (err) {
        console.error(`[EventBus] Handler error on event "${event}":`, err);
      }
    }
  }

  getHistory(event) {
    if (event) return this._history.filter(e => e.event === event);
    return [...this._history];
  }

  clearAll() {
    this._listeners.clear();
    this._onceListeners.clear();
  }
}

export const eventBus = new EventBus();
export default eventBus;
