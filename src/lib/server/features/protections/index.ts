// API pública de `protections` (ARCHITECTURE.md §4). La usa `ai`; `releaseBrake` la usará la administración (L13).
export {
	CONCURRENCY_RETRY_AFTER_SECONDS,
	guardAccess,
	createProtectionsRuntime,
	guardRequest,
	releaseBrake,
	brakeStatus,
	type BrakeReleaseDeps,
	type DailyCostPort,
	type ProtectionsDeps,
	type ProtectionsRuntime,
	type RequestGuardInput
} from './service';
export { ENDPOINT_CHECKS, type EndpointName } from './domain/access';
export { PROTECTIONS_LOG_EVENTS, type ProtectionsLogFields } from './events';
