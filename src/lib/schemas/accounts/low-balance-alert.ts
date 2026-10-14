// Aviso de saldo bajo desde el perfil (W27; T267, BE-FR-49.7). Un importe en euros de créditos escrito a la española («5,50»).
// Vacío desactiva el aviso: desactivarlo debe ser tan fácil como activarlo (16.7).
import * as z from 'zod';
import { parseDecimalEs } from '$lib/schemas/common/decimal-es';

export const LowBalanceAlertSchema = z.strictObject({
	threshold: z
		.string()
		.trim()
		.max(20)
		.refine((text) => text === '' || (parseDecimalEs(text) ?? -1) >= 0, {
			message: 'validation_invalid'
		})
});

/** Umbral en micro-créditos, o `null` si el campo está vacío. */
export function thresholdMicroOf(text: string): number | null {
	if (text === '') return null;
	const value = parseDecimalEs(text);
	return value === undefined ? null : Math.round(value * 1_000_000);
}
