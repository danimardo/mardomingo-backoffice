// Formato de cifras de compra en español: euros con coma decimal y créditos enteros con separador de miles (UX-05).
const euros = new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' });
const credits = new Intl.NumberFormat('es-ES', { maximumFractionDigits: 0 });

export function formatEuros(cents: number): string {
	return euros.format(cents / 100);
}

/** Créditos a partir de micro-créditos (×10⁶), sin decimales. */
export function formatCredits(creditsMicro: number): string {
	return credits.format(creditsMicro / 1_000_000);
}
