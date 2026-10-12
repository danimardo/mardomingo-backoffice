// Doble del proveedor de pagos para las pruebas (T230): puede fallar al crear el cobro y repetir un evento de webhook, que es
// lo que hay que tolerar sin acreditar dos veces. Los eventos que devuelve son los mismos que los del simulado.
import { createSimulatedProvider } from './simulated';
import type { CheckoutOutcome, PaymentEvent, PaymentsProvider, RefundOutcome } from './provider';

export interface FakePaymentsProvider extends PaymentsProvider {
	/** Eventos entregados por `handleWebhook`, para comprobar que el servicio es idempotente. */
	readonly deliveries: readonly PaymentEvent[];
	/** La siguiente creación de cobro falla (proveedor no disponible). */
	failNextCheckout(): void;
	/** Cada webhook se entrega dos veces: el servicio debe acreditar una sola. */
	repeatWebhooks(): void;
}

export function createFakePaymentsProvider(): FakePaymentsProvider {
	const deliveries: PaymentEvent[] = [];
	let failNext = false;
	let repeat = false;
	const simulated = createSimulatedProvider();
	return {
		name: 'simulated',
		get deliveries() {
			return deliveries;
		},
		failNextCheckout() {
			failNext = true;
		},
		repeatWebhooks() {
			repeat = true;
		},
		createCheckout(input): CheckoutOutcome {
			if (failNext) {
				failNext = false;
				return { ok: false, reason: 'unavailable' };
			}
			return { ok: true, providerRef: `fake_${input.paymentId}` };
		},
		handleWebhook(body: unknown): readonly PaymentEvent[] {
			const normalized = simulated.handleWebhook(body);
			const events = repeat ? [...normalized, ...normalized] : normalized;
			deliveries.push(...events);
			return events;
		},
		refund(): RefundOutcome {
			return { ok: true };
		}
	};
}
