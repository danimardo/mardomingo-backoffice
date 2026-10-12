// Contracargo (BE-FR-28; T229). Sin I/O. Lo que el contracargo intenta recuperar son los créditos de la compra menos los ya
// retirados por reembolsos (H-12). Se retira de la bolsa lo que haya; el resto pasa a deuda SIN el tope max_debt, y la cuenta
// queda bloqueada hasta revisión del administrador.

export interface ChargebackInput {
	readonly purchaseCreditsMicro: number;
	readonly refundedCreditsMicro: number;
	readonly bucketRemainingMicro: number;
}

export interface ChargebackOutcome {
	readonly withdrawnMicro: number;
	readonly debtAddedMicro: number;
	readonly accountBlocked: true;
	readonly status: 'chargeback';
}

export function applyChargeback(input: ChargebackInput): ChargebackOutcome {
	const target = input.purchaseCreditsMicro - input.refundedCreditsMicro;
	const withdrawnMicro = Math.min(target, input.bucketRemainingMicro);
	return {
		withdrawnMicro,
		debtAddedMicro: target - withdrawnMicro,
		accountBlocked: true,
		status: 'chargeback'
	};
}
