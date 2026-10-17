// Reglas de la transcripción (E08; FR-032, FR-055, FR-070, BE-FR-35, BE-FR-44; T184). Puro: sin I/O ni otras
// funcionalidades. El servicio mide el audio con ffprobe y decide con estas reglas qué proveedor atiende, qué se cobra y
// qué error se devuelve.

/** Motivo saneado con el que falla un proveedor de transcripción. */
export type ProviderOutcome =
	| 'served'
	| 'billing'
	| 'timeout'
	| 'unavailable'
	| 'http'
	| 'invalid'
	| 'aborted'
	| 'not_configured';

export type TranscriptionProvider = 'primary' | 'backup';

export type PlanResult =
	{ readonly ok: true; readonly order: readonly TranscriptionProvider[] } | { readonly ok: false };

/** Orden de los proveedores activos. Sin ninguno, la configuración no es válida. */
export function planTranscription(input: {
	readonly primaryEnabled: boolean;
	readonly backupEnabled: boolean;
}): PlanResult {
	const order: TranscriptionProvider[] = [];
	if (input.primaryEnabled) order.push('primary');
	if (input.backupEnabled) order.push('backup');
	return order.length > 0 ? { ok: true, order } : { ok: false };
}

/** La duración medida no puede pasar de `max_audio_seconds` más la tolerancia (BE-FR-44; AUDIO_TOO_LONG). */
export function audioLimitOf(input: {
	readonly durationSeconds: number;
	readonly maxSeconds: number;
	readonly toleranceSeconds: number;
}): { readonly ok: true } | { readonly ok: false; readonly maxSeconds: number } {
	if (input.durationSeconds <= input.maxSeconds + input.toleranceSeconds) return { ok: true };
	return { ok: false, maxSeconds: input.maxSeconds };
}

/** Coste de Voxtral en micro-USD: segundos × precio por minuto / 60, redondeado hacia arriba. */
export function voxtralCostMicroUsd(input: {
	readonly seconds: number;
	readonly pricePerMinuteMicroUsd: number;
}): number {
	return Math.ceil((input.seconds * input.pricePerMinuteMicroUsd) / 60);
}

/** Segundos que se facturan: los del proveedor si los informa; si no, los medidos en el servidor (nunca los del cliente). */
export function secondsToBill(input: {
	readonly providerSeconds: number | null;
	readonly measuredSeconds: number;
}): number {
	return input.providerSeconds ?? input.measuredSeconds;
}

/** Fallo de todos los proveedores: el motivo de cada uno, o `null` si no está configurado (api-v1 E08). */
export function transcriptionFailure(
	primary: ProviderOutcome,
	backup: ProviderOutcome
): {
	readonly code: 'TRANSCRIPTION_FAILED';
	readonly primaryError: string | null;
	readonly backupError: string | null;
} {
	return {
		code: 'TRANSCRIPTION_FAILED',
		primaryError: primary === 'not_configured' ? null : primary,
		backupError: backup === 'not_configured' ? null : backup
	};
}
