// Alerta manual de facturación de Mistral (W44; BE-FR-33, BE-FR-55; C-55) contra SQLite real: el motivo es de 1 a 500 caracteres
// tras recortar. Fuera de ese rango no levanta la alerta ni audita; dentro, la entrada guarda el motivo recortado.
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createFakeEmailSender } from '$lib/server/adapters/resend/fake-sender';
import type { AuditDeps } from '$lib/server/features/audit';
import { adminAudit } from '$lib/server/features/audit/schema';
import { createIdGenerator } from '$lib/server/shared/ids';
import { creditsFixture, type CreditsFixture } from '../../../../../tests/builders/credits';
import { seededRandomBytes } from '../../../../../tests/builders/ids';
import type { AlertDeps } from './alerts';
import { activeAlerts } from './alerts-read';
import { setMistralBillingError } from './mistral-billing';

let f: CreditsFixture;
let deps: AlertDeps & { readonly audit: AuditDeps };
let adminId: string;

beforeEach(() => {
	f = creditsFixture(Date.UTC(2026, 10, 18, 9, 0, 0));
	adminId = f.addUser('usr_admin_mistral', 'admin');
	deps = {
		db: f.db,
		logger: f.logger,
		clock: f.clock,
		sender: createFakeEmailSender(),
		adminEmail: () => 'admin@mardomingo.test',
		supportEmail: () => 'soporte@mardomingo.test',
		audit: { clock: f.clock, ids: createIdGenerator(seededRandomBytes(55)), logger: f.logger }
	};
});

afterEach(() => {
	f.close();
});

describe('motivo de la alerta de Mistral (C-55)', () => {
	it.each(['', '   ', 'x'.repeat(501)])(
		'un motivo vacío o de más de 500 caracteres no levanta la alerta ni audita (%#)',
		async (reason) => {
			await expect(
				setMistralBillingError(deps, { adminId, error: true, reason })
			).rejects.toMatchObject({ code: 'VALIDATION_ERROR', details: { field: 'reason' } });

			expect(activeAlerts(f.db)).toEqual([]);
			expect(f.db.select().from(adminAudit).all()).toEqual([]);
		}
	);

	it('con motivo válido levanta la alerta y audita el motivo recortado', async () => {
		const entryId = await setMistralBillingError(deps, {
			adminId,
			error: true,
			reason: `  ${'x'.repeat(500)}  `
		});

		expect(activeAlerts(f.db).map((alert) => alert.key)).toEqual(['mistral_billing']);
		expect(f.db.select().from(adminAudit).all()).toEqual([
			expect.objectContaining({ id: entryId, reason: 'x'.repeat(500) })
		]);
	});
});
