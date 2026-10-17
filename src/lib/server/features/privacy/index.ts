// API pública de `privacy` (ARCHITECTURE.md §4). Sin tablas: orquesta a las demás funcionalidades. Las rutas y las tareas
// programadas solo importan este fichero.
import {
	deleteAccount,
	exportUserData,
	type DeleteAccountInput,
	type DeleteAccountOutcome,
	type PrivacyDeps,
	type UserDataExport
} from './service';

export { PRIVACY_LOG_EVENTS, type PrivacyLogFields } from './events';
export type { DeleteAccountInput, DeleteAccountOutcome, PrivacyDeps, UserDataExport };

export interface Privacy {
	/** Exportación RGPD de la cuenta (W28, BE-FR-08). */
	exportUserData(userId: string): UserDataExport;
	/** Borrado de la cuenta (W29, BE-FR-07) o por inactividad (BE-FR-86). */
	deleteAccount(input: DeleteAccountInput): Promise<DeleteAccountOutcome>;
}

export function createPrivacy(deps: PrivacyDeps): Privacy {
	return {
		exportUserData: (userId) => exportUserData(deps, userId),
		deleteAccount: (input) => deleteAccount(deps, input)
	};
}
