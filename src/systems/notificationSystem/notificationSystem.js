// ================================================================
// IMMORTAIL™ — NOTIFICATION SYSTEM
// Manages browser push notifications for reminders.
// ================================================================

let _permission = 'default';

export async function initNotifications() {
  if (!('Notification' in window)) return;
  _permission = Notification.permission;
}

export async function requestNotificationPermission() {
  if (!('Notification' in window)) return false;
  _permission = await Notification.requestPermission();
  return _permission === 'granted';
}

export function isNotificationsGranted() {
  return _permission === 'granted';
}

export function sendLocalNotification(title, body, icon = '/icons/icon-192.png') {
  if (_permission !== 'granted') return;
  try {
    new Notification(title, { body, icon, badge: icon });
  } catch (err) {
    console.warn('[Notifications] Failed:', err.message);
  }
}

export function scheduleReminder(title, body, delayMs) {
  if (_permission !== 'granted') return null;
  const id = setTimeout(() => sendLocalNotification(title, body), delayMs);
  return id;
}

export function cancelReminder(id) {
  if (id) clearTimeout(id);
}
