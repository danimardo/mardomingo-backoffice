// Proveedor simulado (BE-FR-25, BE-FR-24; T230). Completa la compra al instante: el cobro no existe, así que la compra
// simulada solo la puede hacer un tester (la disponibilidad la decide `payments`). Genera la referencia del proveedor a partir
// del identificador del pago; los eventos llegan en un cuerpo con forma conocida, que se valida antes de normalizarse.
import * as z from 'zod';
import type { CheckoutOutcome, PaymentEvent, PaymentsProvider, RefundOutcome } from './provider';

const SimulatedEvent = z.discriminatedUnion('type', [
	z.strictObject({ type: z.literal('payment_completed'), providerRef: z.string().min(1) }),
	z.strictObject({
		type: z.literal('payment_refunded'),
		providerRef: z.string().min(1),
		amountEurCents: z.int().positive()
	}),
	z.strictObject({ type: z.literal('chargeback_opened'), providerRef: z.string().min(1) })
]);

export function createSimulatedProvider(): PaymentsProvider {
	return {
		name: 'simulated',
		createCheckout(input): CheckoutOutcome {
			return { ok: true, providerRef: `sim_${input.paymentId}` };
		},
		handleWebhook(body: unknown): readonly PaymentEvent[] {
			const parsed = SimulatedEvent.safeParse(body);
			return parsed.success ? [parsed.data] : [];
		},
		refund(): RefundOutcome {
			return { ok: true };
		}
	};
}
