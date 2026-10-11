// API pública de `notifications` (ARCHITECTURE.md §4). Hoy solo envía los emails de la cuenta (L03); el resto llega
// con sus lotes.
export { sendAccountEmail, type AccountEmail, type NotificationsDeps } from './service';
export type { EmailReason } from './events';
export { NOTIFICATIONS_LOG_EVENTS, type NotificationsLogFields } from './events';
export { alertKeys, type AlertKey } from './domain/alert-state';
export { raiseAlert, clearAlert, type AlertDeps } from './alerts';
