// Paso de confirmación de la compra (UX-05; T245): la casilla de renuncia nunca va premarcada, su error se enlaza con la
// casilla, el precio se muestra con IVA incluido y los datos fiscales van plegados hasta que se piden.
import { render, screen } from '@testing-library/svelte';
import { describe, expect, it } from 'vitest';
import PurchaseStep from './PurchaseStep.svelte';

const PACK = {
	id: 'pck_seed_10eur',
	name: 'Pack 10 €',
	priceCents: 1000,
	creditsMicro: 10_500_000_000
};
const BASE = {
	pack: PACK,
	intentId: '11111111-1111-4111-8111-111111111111',
	waiverVersion: '2026-10-11',
	billing: {}
};

describe('PurchaseStep', () => {
	it('la casilla de renuncia sale sin marcar; la obligatoriedad la valida el servidor, sin bloquear el envío', () => {
		render(PurchaseStep, { props: BASE });

		const waiver = screen.getByRole('checkbox', { name: /renuncio a mi derecho de desistimiento/ });
		expect(waiver).toHaveProperty('checked', false);
		expect(waiver.hasAttribute('required')).toBe(false);
	});

	it('un error de la renuncia se enlaza con su casilla por aria-describedby', () => {
		render(PurchaseStep, {
			props: { ...BASE, errors: { waiverAccepted: 'Debes aceptar la renuncia.' } }
		});

		const waiver = screen.getByRole('checkbox', { name: /renuncio a mi derecho de desistimiento/ });
		expect(waiver.getAttribute('aria-invalid')).toBe('true');
		const describedBy = waiver.getAttribute('aria-describedby');
		expect(describedBy).toBeTruthy();
		expect(document.getElementById(String(describedBy))?.textContent).toContain(
			'Debes aceptar la renuncia.'
		);
	});

	it('el botón dice el precio con IVA incluido y el envío lleva el id de intento', () => {
		const { container } = render(PurchaseStep, { props: BASE });

		expect(screen.getByRole('button', { name: /Comprar 10,00\s€ de créditos/ })).toBeTruthy();
		expect(container.querySelector('input[name="intentId"]')?.getAttribute('value')).toBe(
			BASE.intentId
		);
		expect(screen.getByText(/IVA del 21 % incluido/)).toBeTruthy();
	});

	it('los datos fiscales están plegados por defecto y se abren si hay errores fiscales', async () => {
		const { container, rerender } = render(PurchaseStep, { props: BASE });
		expect(container.querySelector('details')?.hasAttribute('open')).toBe(false);

		await rerender({ ...BASE, errors: { taxId: 'El NIF no es válido.' } });
		expect(container.querySelector('details')?.hasAttribute('open')).toBe(true);
	});
});
