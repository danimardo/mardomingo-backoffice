// Adaptadores de pagos (BE-FR-24; T230): el simulado genera la referencia y normaliza webhooks conocidos; el doble puede
// fallar al cobrar y repetir eventos.
import { describe, expect, it } from 'vitest';
import { createFakePaymentsProvider } from './fake';
import { createSimulatedProvider } from './simulated';

describe('simulated', () => {
	it('genera la referencia del proveedor a partir del identificador del pago y completa al instante', () => {
		expect(
			createSimulatedProvider().createCheckout({ paymentId: 'pay_1', amountEurCents: 500 })
		).toEqual({
			ok: true,
			providerRef: 'sim_pay_1'
		});
	});

	it('normaliza un webhook de pago completado', () => {
		expect(
			createSimulatedProvider().handleWebhook({
				type: 'payment_completed',
				providerRef: 'sim_pay_1'
			})
		).toEqual([{ type: 'payment_completed', providerRef: 'sim_pay_1' }]);
	});

	it('normaliza un reembolso con su importe', () => {
		expect(
			createSimulatedProvider().handleWebhook({
				type: 'payment_refunded',
				providerRef: 'sim_pay_1',
				amountEurCents: 400
			})
		).toEqual([{ type: 'payment_refunded', providerRef: 'sim_pay_1', amountEurCents: 400 }]);
	});

	it('un cuerpo no reconocido o con campos extra no produce eventos', () => {
		const simulated = createSimulatedProvider();

		expect(simulated.handleWebhook({ type: 'otra_cosa', providerRef: 'x' })).toEqual([]);
		expect(
			simulated.handleWebhook({ type: 'payment_completed', providerRef: 'x', extra: 1 })
		).toEqual([]);
		expect(simulated.handleWebhook('texto')).toEqual([]);
	});

	it('el reembolso en simulado siempre prospera', () => {
		expect(
			createSimulatedProvider().refund({ providerRef: 'sim_pay_1', amountEurCents: 100 })
		).toEqual({ ok: true });
	});
});

describe('fake', () => {
	it('puede fallar la siguiente creación de cobro, y solo esa', () => {
		const fake = createFakePaymentsProvider();
		fake.failNextCheckout();

		expect(fake.createCheckout({ paymentId: 'pay_1', amountEurCents: 500 })).toEqual({
			ok: false,
			reason: 'unavailable'
		});
		expect(fake.createCheckout({ paymentId: 'pay_1', amountEurCents: 500 })).toEqual({
			ok: true,
			providerRef: 'fake_pay_1'
		});
	});

	it('repite cada evento de webhook cuando se pide, y lo registra', () => {
		const fake = createFakePaymentsProvider();
		fake.repeatWebhooks();

		const events = fake.handleWebhook({ type: 'payment_completed', providerRef: 'fake_pay_1' });

		expect(events).toHaveLength(2);
		expect(fake.deliveries).toHaveLength(2);
	});
});
