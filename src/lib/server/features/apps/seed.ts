// _Seed_ de `apps` (BE-FR-62 perfil inicial, BE-FR-31; T080). Idempotente: cada fila se inserta solo si no existe, así
// que dos ejecuciones dejan el mismo resultado y nunca se pisa un valor que el administrador ya haya cambiado.
// Las operaciones de `secretario` quedan inactivas: sus modelos, respaldos y topes son PROVISIONALES (T079).
import { toMicro } from '$lib/shared/money';
import type { EpochMs } from '$lib/shared/time';
import type { Tx } from '$lib/server/db/tx';
import {
	DEFAULT_SETTINGS,
	PROVISIONAL_CHAT_MAX_COST_MICRO,
	PROVISIONAL_CHAT_MAX_OUTPUT_TOKENS,
	PROVISIONAL_IMAGE_MAX_COST_MICRO,
	PROVISIONAL_TRANSCRIPTION_MAX_COST_MICRO,
	SECRETARIO_LINKS,
	SECRETARIO_OPERATIONS,
	SECRETARIO_OVERRIDES,
	SECRETARIO_SYNC_SCHEMA,
	TRANSCRIPTION_PRIMARY_MODEL,
	type DefaultOperation,
	type OperationKind
} from './defaults';
import { isSettingKey, type TranscriptionConfig } from './json-schemas';
import {
	seedInsertApp,
	seedInsertOperation,
	seedInsertSetting,
	type OperationInsert
} from './repository';

export const SECRETARIO_APP_ID = 'app_secretario';

/** Configuración de transcripción sembrada: el respaldo es PROVISIONAL (T079), así que no hay respaldo todavía. */
const TRANSCRIPTION_CONFIG: TranscriptionConfig = Object.freeze({
	primary: {
		enabled: true,
		model: TRANSCRIPTION_PRIMARY_MODEL,
		timeout_ms: 45_000,
		retry_delays_ms: [2000, 4000, 8000]
	},
	backup: null
});

function provisionalMaxCost(kind: OperationKind): number {
	if (kind === 'transcription') return PROVISIONAL_TRANSCRIPTION_MAX_COST_MICRO;
	if (kind === 'image') return PROVISIONAL_IMAGE_MAX_COST_MICRO;
	return PROVISIONAL_CHAT_MAX_COST_MICRO;
}

function operationRow(operation: DefaultOperation, now: EpochMs): OperationInsert {
	const chat = operation.kind === 'chat';
	return {
		id: `aop_secretario_${operation.key}`,
		appId: SECRETARIO_APP_ID,
		key: operation.key,
		name: operation.name,
		kind: operation.kind,
		mode: 'libre',
		model: null,
		fallbackModels: [],
		preferredProvider: null,
		marginOverridePpm: null,
		temperatureMilli: 700,
		maxOutputTokens: chat ? PROVISIONAL_CHAT_MAX_OUTPUT_TOKENS : null,
		maxCostMicro: toMicro(provisionalMaxCost(operation.kind)),
		estimatedMaxCostMicroUsd: null,
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
export function seedApps(tx: Tx, now: EpochMs): void {
	for (const [key, value] of Object.entries(DEFAULT_SETTINGS)) {
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
