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

/** Créditos que da cada euro del paquete, bonificación incluida (para comparar paquetes; el cobro es el precio). */
export function formatCreditsPerEuro(priceCents: number, creditsMicro: number): string {
	if (priceCents <= 0) return '';
	return formatCreditsMicro(Math.round((creditsMicro * 100) / priceCents));
}

/** Micro-créditos que aporta la bonificación: los créditos del paquete ya la incluyen (`packCreditsMicro`). */
export function bonusCreditsMicro(creditsMicro: number, bonusPct: number): number {
	if (bonusPct <= 0) return 0;
	return Math.round(creditsMicro - (creditsMicro * 100) / (100 + bonusPct));
}

/** Paquete que se destaca: el de mayor bonificación; con empate, el primero. Sin ninguna bonificación, ninguno. */
export function bestPackId(packs: readonly { id: string; bonusPct: number }[]): string | null {
	let best: { id: string; bonusPct: number } | null = null;
	for (const pack of packs) {
		if (pack.bonusPct > 0 && (best === null || pack.bonusPct > best.bonusPct)) best = pack;
	}
	return best?.id ?? null;
}
