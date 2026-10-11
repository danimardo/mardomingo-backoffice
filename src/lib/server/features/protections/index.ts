// API pública de `protections` (ARCHITECTURE.md §4). Solo la usa `ai` (y, en L14/L15, las rutas de sincronización).
export { guardAccess, type ProtectionsDeps } from './service';
export { ENDPOINT_CHECKS, type EndpointName } from './domain/access';
export { PROTECTIONS_LOG_EVENTS, type ProtectionsLogFields } from './events';
