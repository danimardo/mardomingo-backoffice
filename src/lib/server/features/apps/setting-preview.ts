// Previsualización de un cambio de parámetro económico (W38; T309). Lee el valor vigente y valida el nuevo sin escribir nada. El
// techo de las sobrescrituras de las apps lo comprueba `updateSetting` al guardar; la previsualización no lo repite.
import { AppError } from '$lib/server/shared/errors';
import { readSettingValue } from './repository';
import { isSettingKey, parseSettingValue } from './json-schemas';
import type { AppsDeps } from './service';

/** Valor como texto para mostrarlo; `null` si no hay valor o no es válido. */
export function previewText(value: unknown): string | null {
	return typeof value === 'number' || typeof value === 'string' ? String(value) : null;
}

export interface SettingPreview {
	readonly key: string;
	readonly before: string | null;
	readonly after: string | null;
	readonly valid: boolean;
}

export function previewSettingChange(deps: AppsDeps, key: string, value: unknown): SettingPreview {
	if (!isSettingKey(key)) throw new AppError('VALIDATION_ERROR', { field: 'key' });
	const parsed = parseSettingValue(key, value);
	return {
		key,
		before: previewText(readSettingValue(deps.db, deps.logger, key)),
		after: parsed.success ? previewText(parsed.data) : null,
		valid: parsed.success
	};
}
