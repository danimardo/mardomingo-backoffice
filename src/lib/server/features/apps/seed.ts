// _Seed_ de `apps` (BE-FR-62 perfil inicial, BE-FR-31; T080). Idempotente: cada fila se inserta solo si no existe, así
// que dos ejecuciones dejan el mismo resultado y nunca se pisa un valor que el administrador ya haya cambiado.
// Las operaciones de `secretario` quedan inactivas hasta que el administrador las active; sus modelos y topes son los
// aprobados por el propietario (T079).
import { toMicro, toMicroUsd } from '$lib/shared/money';
import type { EpochMs } from '$lib/shared/time';
import type { Tx } from '$lib/server/db/tx';
import {
	DEFAULT_SETTINGS,
	SECRETARIO_LINKS,
	SECRETARIO_OPERATIONS,
	SECRETARIO_OVERRIDES,
	SECRETARIO_SYNC_SCHEMA,
	TRANSCRIPTION_BACKUP_MODEL,
	TRANSCRIPTION_BACKUP_TIMEOUT_MS,
	TRANSCRIPTION_PRIMARY_MODEL,
	approvedOperationOf,
	type DefaultOperation
} from './defaults';
import { isSettingKey, type TranscriptionConfig } from './json-schemas';
import {
	seedInsertApp,
	seedInsertOperation,
	seedInsertSetting,
	type OperationInsert
} from './repository';

export const SECRETARIO_APP_ID = 'app_secretario';

/** Configuración de transcripción sembrada: primario Voxtral y respaldo aprobado (T079). */
const TRANSCRIPTION_CONFIG: TranscriptionConfig = Object.freeze({
	primary: {
		enabled: true,
		model: TRANSCRIPTION_PRIMARY_MODEL,
		timeout_ms: 45_000,
		retry_delays_ms: [2000, 4000, 8000]
	},
	backup: {
		model: TRANSCRIPTION_BACKUP_MODEL,
		timeout_ms: TRANSCRIPTION_BACKUP_TIMEOUT_MS
	}
});

function operationRow(operation: DefaultOperation, now: EpochMs): OperationInsert {
	const approved = approvedOperationOf(operation.key);
	return {
		id: `aop_secretario_${operation.key}`,
		appId: SECRETARIO_APP_ID,
		key: operation.key,
		name: operation.name,
		kind: operation.kind,
		mode: 'libre',
		model: approved.model,
		fallbackModels: [...approved.fallbackModels],
		preferredProvider: null,
		marginOverridePpm: null,
		temperatureMilli: 700,
		maxOutputTokens: approved.maxOutputTokens,
		maxCostMicro: toMicro(approved.maxCostMicro),
		estimatedMaxCostMicroUsd:
			approved.estimatedMaxCostMicroUsd === null
				? null
				: toMicroUsd(approved.estimatedMaxCostMicroUsd),
		timeoutMs: operation.timeoutMs,
		capabilities: operation.capabilities,
		limits: operation.limits,
		transcriptionConfig: operation.kind === 'transcription' ? TRANSCRIPTION_CONFIG : null,
		groupLabel: operation.groupLabel,
		active: false,
		createdAt: now,
		updatedAt: now
	};
}

/** Siembra los parámetros, la app `secretario` con sus operaciones y su configuración (dentro de `tx`). */
export function seedApps(
	tx: Tx,
	now: EpochMs,
	overrides: Readonly<Partial<Record<'registrations_per_ip_24h', number>>> = {}
): void {
	for (const [key, value] of Object.entries({ ...DEFAULT_SETTINGS, ...overrides })) {
		if (isSettingKey(key)) seedInsertSetting(tx, key, value, now);
	}
	seedInsertApp(tx, {
		id: SECRETARIO_APP_ID,
		slug: 'secretario',
		name: 'Secretario AI',
		description: '',
		clientTypes: ['desktop'],
		status: 'active',
		links: SECRETARIO_LINKS,
		minAppVersion: '4.0.0',
		recommendedAppVersion: '4.0.0',
		enforceVersion: true,
		maintenanceActive: false,
		maintenanceMessage: '',
		allowedOrigins: [],
		postVerifyText: null,
		settingsOverrides: SECRETARIO_OVERRIDES,
		syncSchema: SECRETARIO_SYNC_SCHEMA,
		supportEmail: null,
		createdAt: now,
		updatedAt: now
	});
	for (const operation of SECRETARIO_OPERATIONS) {
		seedInsertOperation(tx, operationRow(operation, now));
	}
}
