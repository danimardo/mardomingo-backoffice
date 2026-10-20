import { formatCredits as formatCreditsMicro } from '$lib/format/credits';
// Formato de cifras en español: euros con coma decimal y créditos con la regla de BE-FR-22 (UX-05).
const euros = new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' });

export function formatEuros(cents: number): string {
	return euros.format(cents / 100);
}

/** Créditos a partir de micro-créditos (×10⁶), con la regla de BE-FR-22: 10 o más sin decimales, menos de 10 con uno. */
export function formatCredits(creditsMicro: number): string {
	return formatCreditsMicro(creditsMicro);
}
