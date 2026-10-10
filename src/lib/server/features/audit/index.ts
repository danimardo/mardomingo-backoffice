// API pública de `audit` (ARCHITECTURE.md §4): el resto de funcionalidades solo importa este fichero.
export { recordEntry, type AuditDeps, type AuditEntry } from './service';
export { AuditSnapshot, sensitiveFields } from './json-schemas';
export type { AuditLogFields } from './events';
export { AUDIT_LOG_EVENTS } from './events';
