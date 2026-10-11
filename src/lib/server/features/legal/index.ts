// API pública de `legal` (ARCHITECTURE.md §4).
export {
	currentVersions,
	recordAcceptances,
	type AcceptanceInput,
	type LegalDeps
} from './service';
export { pendingAcceptancesOf, type PendingAcceptance } from './pending';
export { seedLegalDocuments, PROVISIONAL_VERSION } from './seed';
export type { AcceptableDocument, CurrentVersion } from './repository';
export { LEGAL_LOG_EVENTS, type LegalLogFields } from './events';
