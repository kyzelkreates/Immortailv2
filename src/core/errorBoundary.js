// ================================================================
// IMMORTAIL™ — ERROR BOUNDARY (JS module + React class)
// ================================================================

import React from 'react';
import { eventBus } from './eventBus.js';
import { EVENT } from './constants.js';
import { setLastError } from './storage.js';

// ----------------------------------------------------------------
// GLOBAL ERROR CAPTURE — catches unhandled promise rejections
// ----------------------------------------------------------------
export function initGlobalErrorHandlers() {
  window.addEventListener('unhandledrejection', (event) => {
    console.error('[ErrorBoundary] Unhandled rejection:', event.reason);
    const error = { message: event.reason?.message || String(event.reason), type: 'unhandledRejection', ts: Date.now() };
    setLastError(error);
    eventBus.emit(EVENT.ERROR, { error });
    event.preventDefault();
  });

  window.addEventListener('error', (event) => {
    console.error('[ErrorBoundary] Uncaught error:', event.error);
    const error = { message: event.error?.message || event.message, type: 'uncaughtError', ts: Date.now() };
    setLastError(error);
    eventBus.emit(EVENT.ERROR, { error });
  });
}

// ----------------------------------------------------------------
// REACT ERROR BOUNDARY COMPONENT
// ----------------------------------------------------------------
export class AppErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    console.error('[AppErrorBoundary] Component error:', error, info);
    setLastError({ message: error.message, type: 'componentError', stack: info.componentStack, ts: Date.now() });
    eventBus.emit(EVENT.ERROR, { error: { message: error.message } });
  }

  handleReset() {
    this.setState({ hasError: false, error: null });
  }

  render() {
    if (this.state.hasError) {
      return React.createElement(ErrorFallback, {
        error: this.state.error,
        onReset: () => this.handleReset()
      });
    }
    return this.props.children;
  }
}

// ----------------------------------------------------------------
// FALLBACK UI — never a blank screen
// ----------------------------------------------------------------
function ErrorFallback({ error, onReset }) {
  return React.createElement('div', { style: styles.container },
    React.createElement('div', { style: styles.card },
      React.createElement('div', { style: styles.icon }, '🐾'),
      React.createElement('h2', { style: styles.title }, 'Something went wrong'),
      React.createElement('p', { style: styles.message }, error?.message || 'An unexpected error occurred.'),
      React.createElement('div', { style: styles.actions },
        React.createElement('button', { style: styles.btnPrimary, onClick: onReset }, 'Try again'),
        React.createElement('button', { style: styles.btnSecondary, onClick: () => window.location.reload() }, 'Reload app')
      )
    )
  );
}

const styles = {
  container: { display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100dvh', background: '#0a0a0f', padding: '24px' },
  card: { background: '#13131c', border: '1px solid #2a2a3f', borderRadius: '16px', padding: '40px 32px', maxWidth: '400px', width: '100%', textAlign: 'center' },
  icon: { fontSize: '48px', marginBottom: '16px' },
  title: { color: '#e8e8f0', fontSize: '20px', fontWeight: 600, margin: '0 0 12px' },
  message: { color: '#7a7a9a', fontSize: '14px', margin: '0 0 28px', lineHeight: 1.5 },
  actions: { display: 'flex', gap: '12px', justifyContent: 'center' },
  btnPrimary: { background: '#5c5cff', color: '#fff', border: 'none', borderRadius: '8px', padding: '10px 20px', cursor: 'pointer', fontSize: '14px', fontWeight: 600 },
  btnSecondary: { background: 'transparent', color: '#7a7a9a', border: '1px solid #2a2a3f', borderRadius: '8px', padding: '10px 20px', cursor: 'pointer', fontSize: '14px' },
};
