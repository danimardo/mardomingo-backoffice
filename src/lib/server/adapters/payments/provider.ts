// Interfaz del proveedor de pagos (BE-FR-24, BE-FR-29; T230). Los eventos llegan normalizados: el servicio de `payments`
// no conoce el formato de ningún proveedor. En la v4 solo existe `simulated`; `stripe` queda fuera (BE-FR-29).

export type PaymentEvent =
	| { readonly type: 'payment_completed'; readonly providerRef: string }
	| {
			readonly type: 'payment_refunded';
			readonly providerRef: string;
			readonly amountEurCents: number;
	  }
	| { readonly type: 'chargeback_opened'; readonly providerRef: string };

export type CheckoutOutcome =
	| { readonly ok: true; readonly providerRef: string }
	| { readonly ok: false; readonly reason: 'unavailable' };

export type RefundOutcome =
	{ readonly ok: true } | { readonly ok: false; readonly reason: 'unavailable' };

export interface PaymentsProvider {
	readonly name: 'simulated' | 'stripe';
	/** Inicia el cobro de una compra; devuelve la referencia del proveedor que identifica después sus eventos. */
	createCheckout(input: {
		readonly paymentId: string;
		readonly amountEurCents: number;
	}): CheckoutOutcome;
	/** Convierte el cuerpo de un webhook en eventos normalizados. Un cuerpo no reconocido no produce eventos. */
	handleWebhook(body: unknown): readonly PaymentEvent[];
	/** Ordena la devolución de un importe en el proveedor (solo con proveedor real; en simulado siempre prospera). */
	refund(input: { readonly providerRef: string; readonly amountEurCents: number }): RefundOutcome;
}
