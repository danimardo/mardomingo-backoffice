// API pública de `privacy` (ARCHITECTURE.md §4). Sin tablas: orquesta a las demás funcionalidades. Las rutas y las tareas
// programadas solo importan este fichero.
import {
	applyRetention,
	deleteAccount,
	exportUserData,
	processInactive,
	type DeleteAccountInput,
	type DeleteAccountOutcome,
	type InactiveReport,
	type PrivacyDeps,
	type RetentionReport,
	type UserDataExport
} from './service';

export { PRIVACY_LOG_EVENTS, type PrivacyLogFields } from './events';
export type {
	DeleteAccountInput,
	DeleteAccountOutcome,
	InactiveReport,
	PrivacyDeps,
	RetentionReport,
	UserDataExport
};

export interface Privacy {
	/** Exportación RGPD de la cuenta (W28, BE-FR-08). */
	exportUserData(userId: string): UserDataExport;
	/** Borrado de la cuenta (W29, BE-FR-07) o por inactividad (BE-FR-86). */
	deleteAccount(input: DeleteAccountInput): Promise<DeleteAccountOutcome>;
	/** Tarea `retention`: aplica los plazos de BE-FR-83. */
	applyRetention(): RetentionReport;
	/** Tarea `inactive-accounts`: aviso, cancelación y borrado de cuentas inactivas (BE-FR-86). */
	processInactive(): Promise<InactiveReport>;
}

export function createPrivacy(deps: PrivacyDeps): Privacy {
	return {
		exportUserData: (userId) => exportUserData(deps, userId),
		deleteAccount: (input) => deleteAccount(deps, input),
		applyRetention: () => applyRetention(deps),
		processInactive: () => processInactive(deps)
	};
}
