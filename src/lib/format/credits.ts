// Formato de importes en créditos para servidor, cliente y emails (BE-FR-22; D-07; T120). Puro: sin I/O ni fechas. Los
// importes entran en micro-créditos (µc) y el resultado es texto ya redondeado.
import { MICRO_PER_CREDIT } from '$lib/shared/money';

const MINUS = '−';
const BELOW_TENTH = '< 0,1';
const ONE_DECIMAL = new Intl.NumberFormat('es-ES', {
	minimumFractionDigits: 0,
	maximumFractionDigits: 1
});
const NO_DECIMALS = new Intl.NumberFormat('es-ES', {
	minimumFractionDigits: 0,
	maximumFractionDigits: 0
});

/**
 * Texto de un importe en créditos: 10 o más, sin decimales; entre 0,1 y 10, con un decimal; cero, «0»; menos de 0,1 (sin
 * ser cero), «< 0,1». Los negativos llevan el signo U+2212 delante del mismo formato.
 */
export function formatCredits(micro: number): string {
	const credits = micro / MICRO_PER_CREDIT;
	const sign = credits < 0 ? MINUS : '';
	const size = Math.abs(credits);
	if (size === 0) return '0';
	if (size < 0.1) return `${sign}${BELOW_TENTH}`;
	if (size < 10) return `${sign}${ONE_DECIMAL.format(size)}`;
	return `${sign}${NO_DECIMALS.format(size)}`;
}
