// API pública de `legal` (ARCHITECTURE.md §4).
export {
	currentDocument,
	currentVersions,
	recordAcceptances,
	recordWithdrawalWaiver,
	type AcceptanceInput,
	type LegalDeps
} from './service';
export type { LegalDocumentView } from './presenters';
export { renderMarkdown } from './domain/markdown';
export { pendingAcceptancesOf, type PendingAcceptance } from './pending';
export { isOwnWithdrawalWaiver } from './repository';
export { acceptDocuments } from './accept-documents';
export { exportAcceptances, type AcceptanceExport } from './export';
export { AcceptTermsBody } from './contract';
export { seedLegalDocuments, PROVISIONAL_VERSION } from './seed';
export type { AcceptableDocument, CurrentVersion } from './repository';
export { LEGAL_LOG_EVENTS, type LegalLogFields } from './events';

// Publicación de versiones legales (T314). Las llama solo la composición y la ruta de administración (W48).
export { publishVersion, type PublishDeps, type PublishInput } from './publish';
export { LEGAL_DOCUMENTS } from './schema';
