// Ajuste de saldo del administrador (W36; BE-FR-18, D-16; T307) contra SQLite real: la vista previa calcula el saldo final que el
// ajuste deja de verdad; una resta por encima del disponible se rechaza en la vista previa y en el servicio sin movimiento; y el ajuste
// aplicado deja el saldo previsto con su entrada de auditoría.
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { creditsFixture, type CreditsFixture } from '../../../../tests/builders/credits';
import { adminAudit } from '../features/audit/schema';
import { eq } from 'drizzle-orm';
import { previewAdjustment } from './balance-adjustment';

let f: CreditsFixture;
let adminId: string;

beforeEach(() => {
	f = creditsFixture(Date.UTC(2026, 9, 17, 9, 0, 0));
	adminId = f.addUser('usr_adj_admin', 'admin');
});

afterEach(() => {
	f.close();
});

function balanceOf(userId: string) {
	const b = f.credits.getBalance(userId);
	return { balanceMicro: b.totalMicro, debtMicro: b.debtMicro, availableMicro: b.availableMicro };
}

describe('ajuste de saldo del administrador (W36, T307)', () => {
	it('un abono aplicado deja el saldo que la vista previa anunció, con su auditoría', () => {
		const userId = f.addUser('usr_adj_abono');
		f.credits.grantWelcome({ userId, emailNormalizedHash: 'hash-adj-abono' });
		const antes = balanceOf(userId);
		const amountMicro = 2_000_000;
		const preview = previewAdjustment({ direction: 'credit', amountMicro, ...antes });
		expect(preview.ok).toBe(true);

		f.credits.adjust({
			adminId,
			userId,
			direction: 'credit',
			kind: 'paid',
			amountMicro,
			reason: 'abono de prueba'
		});

		expect(balanceOf(userId).balanceMicro).toBe(preview.ok ? preview.balanceAfterMicro : NaN);
		expect(
			f.db.select().from(adminAudit).where(eq(adminAudit.action, 'credits.adjust')).all()
		).toHaveLength(1);
	});

	it('una resta por encima del disponible se rechaza en la vista previa y en el servicio, sin movimiento', () => {
		const userId = f.addUser('usr_adj_resta');
		f.credits.grantWelcome({ userId, emailNormalizedHash: 'hash-adj-resta' });
		const antes = balanceOf(userId);
		const amountMicro = antes.availableMicro + 1;

		expect(previewAdjustment({ direction: 'debit', amountMicro, ...antes })).toEqual({
			ok: false,
			reason: 'exceeds_available'
		});
		const outcome = f.credits.adjust({
			adminId,
			userId,
			direction: 'debit',
			kind: 'paid',
			amountMicro,
			reason: 'resta excesiva'
		});
		expect(outcome.ok).toBe(false);
		expect(balanceOf(userId).balanceMicro).toBe(antes.balanceMicro);
		expect(
			f.db.select().from(adminAudit).where(eq(adminAudit.action, 'credits.adjust')).all()
		).toEqual([]);
	});
});
