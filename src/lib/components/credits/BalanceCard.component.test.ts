// Tarjeta del saldo del panel (W18; T261): cada importe con su etiqueta, la deuda solo si existe y el euro sin tipo queda explicado.
import { render, screen } from '@testing-library/svelte';
import { describe, expect, it } from 'vitest';
import BalanceCard from './BalanceCard.svelte';

const MICRO = 1_000_000;

describe('BalanceCard', () => {
	it('muestra total, reservado, equivalente en euros y disponible', () => {
		render(BalanceCard, {
			totalMicro: 12 * MICRO,
			reservedMicro: 2 * MICRO,
			availableMicro: 10 * MICRO,
			debtMicro: 0,
			eurCents: 120
		});

		expect(screen.getByRole('heading', { name: /saldo/i })).toBeInTheDocument();
		expect(screen.getByText('12')).toBeInTheDocument();
		expect(screen.getByText('1,20 €')).toBeInTheDocument();
		expect(screen.queryByText('Deuda pendiente')).toBeNull();
	});

	it('muestra la deuda cuando la hay', () => {
		render(BalanceCard, {
			totalMicro: 0,
			reservedMicro: 0,
			availableMicro: 0,
			debtMicro: 3 * MICRO,
			eurCents: null
		});

		expect(screen.getByText('Deuda pendiente')).toBeInTheDocument();
	});
});
