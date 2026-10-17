// Vista previa del ajuste de saldo del administrador (W36; BE-FR-18, D-16; T307). Función pura: no lee ni escribe nada. Un ingreso
// liquida primero la deuda (`debt_settlement`); una resta nunca supera el saldo disponible, porque el ajuste nunca crea deuda.
export interface AdjustmentInput {
	readonly direction: 'credit' | 'debit';
	readonly amountMicro: number;
	readonly balanceMicro: number;
	readonly debtMicro: number;
	readonly availableMicro: number;
}

export type AdjustmentPreview =
	| {
			readonly ok: true;
			readonly balanceBeforeMicro: number;
			readonly balanceAfterMicro: number;
			readonly debtSettledMicro: number;
	  }
	| { readonly ok: false; readonly reason: 'amount_invalid' | 'exceeds_available' };

export function previewAdjustment(input: AdjustmentInput): AdjustmentPreview {
	if (!Number.isInteger(input.amountMicro) || input.amountMicro <= 0) {
		return { ok: false, reason: 'amount_invalid' };
	}
	if (input.direction === 'debit') {
		if (input.amountMicro > input.availableMicro) return { ok: false, reason: 'exceeds_available' };
		return {
			ok: true,
			balanceBeforeMicro: input.balanceMicro,
			balanceAfterMicro: input.balanceMicro - input.amountMicro,
			debtSettledMicro: 0
		};
	}
	const debtSettledMicro = Math.min(input.debtMicro, input.amountMicro);
	return {
		ok: true,
		balanceBeforeMicro: input.balanceMicro,
		balanceAfterMicro: input.balanceMicro + input.amountMicro,
		debtSettledMicro
	};
}
