// ================================================================
// IMMORTAIL™ — TASK ENGINE
// ALL async operations flow through here.
// No UI component may spawn its own async chains.
// ================================================================

import { eventBus } from './eventBus.js';
import { EVENT, TASK_STATUS, TASK_TYPE, TASK_TIMEOUT } from './constants.js';
import { setLoading, updateLoadingProgress } from './storage.js';

let _taskCounter = 0;
const _activeTasks = new Map();
const _taskHistory = [];
const MAX_HISTORY = 50;

// ----------------------------------------------------------------
// TASK CREATION
// ----------------------------------------------------------------

function createTask(type, label, options = {}) {
  const id = `task_${++_taskCounter}_${Date.now()}`;
  const timeout = options.timeout ?? TASK_TIMEOUT[type] ?? 15000;
  const cancellable = options.cancellable ?? false;

  const task = {
    id,
    type,
    label,
    status: TASK_STATUS.PENDING,
    progress: 0,
    retries: 0,
    maxRetries: options.maxRetries ?? 0,
    createdAt: Date.now(),
    startedAt: null,
    completedAt: null,
    timeout,
    cancellable,
    showLoading: options.showLoading ?? false,
    result: null,
    error: null,
    _resolve: null,
    _reject: null,
    _timeoutId: null,
    _cancelled: false,
  };

  return task;
}

// ----------------------------------------------------------------
// QUEUE & EXECUTE
// ----------------------------------------------------------------

export async function queue(type, label, executor, options = {}) {
  // Prevent duplicate singleton tasks if requested
  if (options.singleton) {
    for (const [, t] of _activeTasks) {
      if (t.type === type && t.status === TASK_STATUS.RUNNING) {
        console.warn(`[TaskEngine] Singleton task "${type}" already running, skipping.`);
        return t._promise;
      }
    }
  }

  const task = createTask(type, label, options);

  const promise = new Promise((resolve, reject) => {
    task._resolve = resolve;
    task._reject = reject;
  });
  task._promise = promise;

  _activeTasks.set(task.id, task);
  _archiveTask(task);

  eventBus.emit(EVENT.TASK_START, { id: task.id, type, label });

  if (task.showLoading) {
    setLoading(true, label, 0, task.cancellable);
  }

  _run(task, executor, options);

  return promise;
}

async function _run(task, executor, options) {
  task.status = TASK_STATUS.RUNNING;
  task.startedAt = Date.now();

  // Timeout guard
  task._timeoutId = setTimeout(() => {
    if (task.status === TASK_STATUS.RUNNING) {
      _failTask(task, new Error(`Task "${task.label}" timed out after ${task.timeout}ms`), TASK_STATUS.TIMEOUT);
    }
  }, task.timeout);

  const progressFn = (pct, msg) => {
    if (task._cancelled || task.status !== TASK_STATUS.RUNNING) return;
    task.progress = pct;
    eventBus.emit(EVENT.TASK_PROGRESS, { id: task.id, progress: pct, message: msg ?? task.label });
    if (task.showLoading) updateLoadingProgress(pct, msg);
  };

  const cancelToken = {
    get cancelled() { return task._cancelled; },
    throw() {
      if (task._cancelled) throw new Error('Task cancelled');
    }
  };

  try {
    const result = await executor({ progress: progressFn, cancel: cancelToken });
    if (!task._cancelled) {
      _completeTask(task, result);
    }
  } catch (err) {
    if (!task._cancelled) {
      if (task.retries < task.maxRetries) {
        task.retries++;
        console.warn(`[TaskEngine] Retrying "${task.label}" (${task.retries}/${task.maxRetries})`);
        await _delay(500 * task.retries);
        _run(task, executor, options);
      } else {
        _failTask(task, err);
      }
    }
  }
}

function _completeTask(task, result) {
  clearTimeout(task._timeoutId);
  task.status = TASK_STATUS.COMPLETE;
  task.result = result;
  task.completedAt = Date.now();
  task.progress = 100;

  if (task.showLoading) setLoading(false);

  eventBus.emit(EVENT.TASK_COMPLETE, { id: task.id, type: task.type, label: task.label, result });
  task._resolve(result);
  _activeTasks.delete(task.id);
}

function _failTask(task, err, status = TASK_STATUS.FAILED) {
  clearTimeout(task._timeoutId);
  task.status = status;
  task.error = err.message;
  task.completedAt = Date.now();

  if (task.showLoading) setLoading(false);

  console.error(`[TaskEngine] Task "${task.label}" ${status}:`, err);
  eventBus.emit(EVENT.TASK_FAILED, { id: task.id, type: task.type, label: task.label, error: err.message, status });
  task._reject(err);
  _activeTasks.delete(task.id);
}

// ----------------------------------------------------------------
// CANCELLATION
// ----------------------------------------------------------------

export function cancelTask(taskId) {
  const task = _activeTasks.get(taskId);
  if (!task || !task.cancellable) return false;
  task._cancelled = true;
  task.status = TASK_STATUS.CANCELLED;
  clearTimeout(task._timeoutId);
  if (task.showLoading) setLoading(false);
  eventBus.emit(EVENT.TASK_CANCELLED, { id: task.id, type: task.type });
  task._resolve(null);
  _activeTasks.delete(taskId);
  return true;
}

export function cancelTasksByType(type) {
  let count = 0;
  for (const [id, task] of _activeTasks) {
    if (task.type === type && task.cancellable) {
      cancelTask(id);
      count++;
    }
  }
  return count;
}

export function cancelAll() {
  const ids = [..._activeTasks.keys()];
  ids.forEach(id => cancelTask(id));
}

// ----------------------------------------------------------------
// INTROSPECTION
// ----------------------------------------------------------------

export function getActiveTasks() {
  return [..._activeTasks.values()].map(t => ({
    id: t.id, type: t.type, label: t.label,
    status: t.status, progress: t.progress, cancellable: t.cancellable
  }));
}

export function getTaskHistory() {
  return [..._taskHistory];
}

export function isTaskRunning(type) {
  for (const [, t] of _activeTasks) {
    if (t.type === type && t.status === TASK_STATUS.RUNNING) return true;
  }
  return false;
}

// ----------------------------------------------------------------
// UTILITY
// ----------------------------------------------------------------

function _archiveTask(task) {
  _taskHistory.push({ id: task.id, type: task.type, label: task.label, createdAt: task.createdAt });
  if (_taskHistory.length > MAX_HISTORY) _taskHistory.shift();
}

function _delay(ms) {
  return new Promise(res => setTimeout(res, ms));
}
