// Exportación de datos (RGPD) contra SQLite real (BE-FR-08; T280): perfil, datos fiscales, documentos sincronizados de cada
// app, movimientos, metadatos de operaciones (sin modelo ni coste real), pagos, facturas y aceptaciones legales; nada de otra
// cuenta; ni secretos de la cuenta; y el registro solo lleva la duración, nunca el contenido.
import { eq } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { eventsNamed } from '../../../../../tests/builders/fake-logger';
import {
	OTHER_USER_ID,
	privacyFixture,
	type PrivacyFixture
} from '../../../../../tests/builders/privacy';
import { toEpochMs } from '$lib/shared/time';
import { account } from '../accounts/schema';
import { creditMovements } from '../credits/schema';
import { invoices } from '../invoicing/schema';
import { SEEDED_APP_ID } from '../../../../../tests/setup/integration.global-setup';

let f: PrivacyFixture;

beforeEach(async () => {
	f = await privacyFixture();
	// Una factura de la compra de la cuenta: el proveedor simulado no emite, así que se inserta como en el test del PDF.
	f.panel.fixture.base.db
		.insert(invoices)
		.values({
			id: 'inv_exportada',
			paymentId: f.panel.paymentId,
			kind: 'simplified',
			series: 'A',
			number: '000001',
			billingSnapshot: null,
			amountEurCents: 1000,
			issueKey: 'key-exportada',
			provider: 'fake',
			providerRef: 'ref-secreta-del-proveedor',
			pdfRef: null,
			issuedAt: toEpochMs(Date.UTC(2026, 9, 11, 8, 0, 0))
		})
		.run();
});

afterEach(() => {
	f.close();
});

describe('exportación de datos (BE-FR-08)', () => {
	it('contiene perfil, datos fiscales, documentos de cada app, movimientos, operaciones, pagos, facturas y aceptaciones', () => {
		const data = f.privacy.exportUserData(f.userId);

		expect(data.schemaVersion).toBe(1);
		expect(data.profile).toMatchObject({
			id: f.userId,
			email: `${f.userId}@ejemplo.es`,
			emailVerified: false
		});
		expect(data.profile?.apps.map((item) => item.appId).sort()).toEqual(
			[SEEDED_APP_ID, f.secondAppId].sort()
		);
		expect(data.profile?.sessions).toHaveLength(2);
		expect(data.billingProfile).toMatchObject({
			kind: 'individual',
			legalName: 'Ana Pérez',
			taxId: '12345678Z',
			country: 'ES'
		});
		expect(data.syncedDocuments.map((item) => item.appId).sort()).toEqual(
			[SEEDED_APP_ID, f.secondAppId].sort()
		);
		expect(data.syncedDocuments.every((item) => item.appName !== '')).toBe(true);
		expect(data.syncedDocuments.find((item) => item.appId === f.secondAppId)?.data).toEqual({
			nota: `dato de ${f.userId} en ${f.secondAppId}`
		});
		const movements = f.panel.fixture.base.db
			.select()
			.from(creditMovements)
			.where(eq(creditMovements.userId, f.userId))
			.all();
		expect(data.movements).toHaveLength(movements.length);
		expect(new Set(data.movements.map((item) => item.type))).toEqual(
			expect.objectContaining(new Set(['welcome', 'purchase', 'usage']))
		);
		expect(data.operations.map((item) => item.status)).toEqual(
			expect.arrayContaining(['ok', 'provider_error', 'cancelled', 'undelivered', 'interrupted'])
		);
		expect(data.operations.every((item) => item.appName !== '' && item.operation !== '')).toBe(
			true
		);
		expect(data.payments).toHaveLength(2);
		expect(data.payments.every((item) => item.packName !== '')).toBe(true);
		expect(data.invoices.map((item) => item.id)).toEqual(['inv_exportada']);
		expect(new Set(data.legalAcceptances.map((item) => item.document))).toEqual(
			new Set(['terms', 'privacy', 'aup', 'withdrawal_waiver'])
		);
	});

	it('no contiene nada de otra cuenta', () => {
		const text = JSON.stringify(f.privacy.exportUserData(f.userId));

		expect(text).not.toContain(OTHER_USER_ID);
		expect(text).not.toContain(`dato de ${OTHER_USER_ID}`);
		expect(text).not.toContain(`${OTHER_USER_ID}@ejemplo.es`);
		const other = f.privacy.exportUserData(f.otherUserId);
		expect(other.profile?.id).toBe(f.otherUserId);
		expect(JSON.stringify(other)).not.toContain(f.userId);
	});

	it('las operaciones no llevan modelo, proveedor ni coste real, ni los pagos y facturas las referencias del proveedor', () => {
		const data = f.privacy.exportUserData(f.userId);
		const text = JSON.stringify(data);

		for (const operation of data.operations) {
			expect(Object.keys(operation).sort()).toEqual(
				[
					'appId',
					'appName',
					'appOperationId',
					'appVersion',
					'audioMs',
					'chargedMicro',
					'completedAt',
					'createdAt',
					'durationMs',
					'errorCode',
					'id',
					'inputTokens',
					'operation',
					'outputTokens',
					'status',
					'truncated'
				].sort()
			);
		}
		// Se vetan las claves (`"clave":`), no las palabras: `provider_error` es un estado legítimo de una operación.
		for (const forbidden of [
			'"costMicroUsd":',
			'"provider":',
			'"model":',
			'"providerRef":',
			'"providerGenerationId":',
			'"fxRateId":',
			'ref-secreta-del-proveedor'
		]) {
			expect(text, forbidden).not.toContain(forbidden);
		}
	});

	it('no incluye secretos de la cuenta: ni el hash de la contraseña ni los tokens de sesión', () => {
		const hash = f.panel.fixture.base.db
			.select({ password: account.password })
			.from(account)
			.where(eq(account.userId, f.userId))
			.get()?.password;
		expect(hash).toBeTruthy();

		const text = JSON.stringify(f.privacy.exportUserData(f.userId));

		expect(text).not.toContain(hash ?? 'sin-hash');
		expect(text).not.toContain(`token-${f.userId}`);
	});

	it('el registro solo lleva la duración: el contenido nunca se registra', () => {
		f.privacy.exportUserData(f.userId);

		const exported = eventsNamed(f.panel.fixture.base.logger, 'privacy.export.generated');
		expect(exported).toHaveLength(1);
		expect(Object.keys(exported[0]?.fields ?? {})).toEqual(['durationMs']);
		const log = JSON.stringify(f.panel.fixture.base.logger.events);
		expect(log).not.toContain(`${f.userId}@ejemplo.es`);
		expect(log).not.toContain(`dato de ${f.userId}`);
		expect(log).not.toContain('12345678Z');
	});

	it('una cuenta que no existe se exporta vacía, sin fallar', () => {
		const data = f.privacy.exportUserData('usr_inexistente');

		expect(data.profile).toBeNull();
		expect(data.billingProfile).toBeNull();
		expect([
			data.syncedDocuments,
			data.movements,
			data.operations,
			data.payments,
			data.invoices,
			data.legalAcceptances
		]).toEqual([[], [], [], [], [], []]);
	});
});
