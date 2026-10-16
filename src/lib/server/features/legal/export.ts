// Exportación de las aceptaciones legales de una cuenta (BE-FR-08). Las aceptaciones no se borran con la cuenta: son la prueba
// del consentimiento (data-model §6). Solo la llama `privacy`.
import { acceptancesOfUser } from './repository';
import type { LegalDeps } from './service';

export interface AcceptanceExport {
	readonly document: string;
	readonly version: string;
	readonly acceptedAt: string;
	readonly ip: string | null;
	readonly appId: string | null;
}

export function exportAcceptances(deps: Pick<LegalDeps, 'db'>, userId: string): AcceptanceExport[] {
	return acceptancesOfUser(deps.db, userId).map((row) => ({
		document: row.document,
		version: row.version,
		acceptedAt: new Date(row.acceptedAt).toISOString(),
		ip: row.ip,
		appId: row.appId
	}));
}
