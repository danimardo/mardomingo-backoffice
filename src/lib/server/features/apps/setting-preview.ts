// Previsualización de un cambio de parámetro económico (W38; T309). Lee el valor vigente y valida el nuevo sin escribir nada. El
// techo de las sobrescrituras de las apps lo comprueba `updateSetting` al guardar; la previsualización no lo repite. Sí repite el
// mínimo de `hold_ttl_seconds` frente a la operación más larga (C-14), que no depende de otras filas de ajustes.
import { AppError } from '$lib/server/shared/errors';
import { readSettingValue } from './repository';
import { isSettingKey, parseAdminSettingValue } from './json-schemas';
import { minHoldTtlSecondsOf, type AppsDeps } from './service';

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
	const parsed = parseAdminSettingValue(key, value);
	const valid =
		parsed.success &&
		!(
			key === 'hold_ttl_seconds' &&
			typeof parsed.data === 'number' &&
			parsed.data < minHoldTtlSecondsOf(deps)
		);
	return {
		key,
		before: previewText(readSettingValue(deps.db, deps.logger, key)),
		after: valid ? previewText(parsed.data) : null,
		valid
	};
}
