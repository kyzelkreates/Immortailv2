// ================================================================
// IMMORTAIL™ — ROUTER
// Sole authority over navigation. No component may call
// window.location or history directly.
// ================================================================

import { eventBus } from './eventBus.js';
import { EVENT, ROUTES } from './constants.js';
import { setCurrentRoute, getState } from './storage.js';
import { queue } from './taskEngine.js';
import { TASK_TYPE } from './constants.js';

let _currentRoute = ROUTES.HOME;
let _transitioning = false;
let _listeners = new Set();
let _routeHistory = [];

// ----------------------------------------------------------------
// INIT — sync with browser history API
// ----------------------------------------------------------------
export function initRouter() {
  const path = window.location.pathname || ROUTES.HOME;
  _currentRoute = _normalizeRoute(path);

  window.addEventListener('popstate', () => {
    const newRoute = _normalizeRoute(window.location.pathname);
    _applyRoute(newRoute);
  });
}

// ----------------------------------------------------------------
// NAVIGATE
// ----------------------------------------------------------------
export async function navigate(route, options = {}) {
  if (!Object.values(ROUTES).includes(route)) {
    console.error(`[Router] Unknown route: "${route}". Falling back to HOME.`);
    route = ROUTES.HOME;
  }

  if (route === _currentRoute && !options.force) return;
  if (_transitioning && !options.force) return;

  _transitioning = true;

  try {
    await queue(
      TASK_TYPE.ROUTE_TRANSITION,
      `Navigating to ${route}`,
      async ({ progress }) => {
        progress(10);
        const state = getState();

        // Guard: redirect to setup if setup not complete
        if (!state.setupComplete && route !== ROUTES.SETUP) {
          route = ROUTES.SETUP;
        }

        progress(50);
        window.history.pushState({ route }, '', route);
        _applyRoute(route, options);
        progress(100);

        return route;
      },
      { timeout: 5000 }
    );
  } catch (err) {
    console.error('[Router] Navigation failed:', err);
    // Safe fallback — always at minimum render home
    _applyRoute(ROUTES.HOME);
  } finally {
    _transitioning = false;
  }
}

// ----------------------------------------------------------------
// REPLACE (no history entry)
// ----------------------------------------------------------------
export function replace(route) {
  if (!Object.values(ROUTES).includes(route)) route = ROUTES.HOME;
  window.history.replaceState({ route }, '', route);
  _applyRoute(route);
}

// ----------------------------------------------------------------
// BACK
// ----------------------------------------------------------------
export function goBack() {
  if (_routeHistory.length > 1) {
    window.history.back();
  } else {
    navigate(ROUTES.HOME);
  }
}

// ----------------------------------------------------------------
// SUBSCRIBE
// ----------------------------------------------------------------
export function onRouteChange(fn) {
  _listeners.add(fn);
  return () => _listeners.delete(fn);
}

export function getCurrentRoute() {
  return _currentRoute;
}

// ----------------------------------------------------------------
// INTERNAL
// ----------------------------------------------------------------
function _applyRoute(route, options = {}) {
  const prev = _currentRoute;
  _currentRoute = route;
  _routeHistory.push(route);
  if (_routeHistory.length > 50) _routeHistory.shift();

  setCurrentRoute(route).catch(() => {});

  eventBus.emit(EVENT.ROUTE_CHANGE, { route, prev, options });
  for (const fn of _listeners) {
    try { fn(route, prev); } catch (e) { console.error('[Router] Listener error:', e); }
  }
}

function _normalizeRoute(path) {
  const valid = Object.values(ROUTES);
  return valid.includes(path) ? path : ROUTES.HOME;
}
