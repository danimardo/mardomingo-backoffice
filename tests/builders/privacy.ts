// Montaje de `privacy` para las pruebas de integración (T280, T282): la cuenta del panel (bolsas, reserva, deuda, operaciones,
// compras y perfil fiscal) más lo que solo `accounts`, `sync` y `legal` guardan: credencial con contraseña, sesiones,
// actividad por app, tokens, documentos sincronizados de dos apps y aceptaciones. Además, una segunda cuenta con sus propios
// datos para comprobar que nada se mezcla. Todo se crea con los servicios y con filas de prueba, con semilla y reloj fijos.
import { hashPassword } from 'better-auth/crypto';
import { createFakeCaptchaVerifier } from '$lib/server/adapters/turnstile/fake-verifier';
import {
	createFakeEmailSender,
	type FakeEmailSender
} from '$lib/server/adapters/resend/fake-sender';
import { createAccounts, normalizeEmail, type Accounts } from '$lib/server/features/accounts';
import { hashNormalizedEmail } from '$lib/server/features/accounts/email-hash';
import {
	account,
	session,
	userAppActivity,
	verification
} from '$lib/server/features/accounts/schema';
import { createPrivacy, type Privacy, type PrivacyDeps } from '$lib/server/features/privacy';
import { currentVersions, recordAcceptances } from '$lib/server/features/legal';
import { syncDocuments, type SyncDeps } from '$lib/server/features/sync';
import { immediateTransaction } from '$lib/server/db/tx';
import { createIdGenerator } from '$lib/server/shared/ids';
import { toEpochMs } from '$lib/shared/time';
import { SEEDED_APP_ID } from '../setup/integration.global-setup';
import { addSecondApp, appsTestContext } from './apps';
import { seededRandomBytes } from './ids';
import { insertInFlightOperation } from './ai-operations';
import { PANEL_USER, panelAccountFixture, type PanelAccount } from './panel-account';

export const PRIVACY_PASSWORD = 'contraseña-larga-123';
export const OTHER_USER_ID = 'usr_otra';
export const EMAIL_HASH_KEY = 'clave-de-hash-de-prueba-de-32-caracteres!!';

/** Hash de bienvenida (BE-FR-11.5) de una dirección, con la clave de las pruebas. */
export function welcomeHashOf(address: string): string {
	return hashNormalizedEmail(normalizeEmail(address), EMAIL_HASH_KEY);
}

export interface PrivacyFixture {
	readonly panel: PanelAccount;
	readonly userId: string;
	readonly otherUserId: string;
	readonly secondAppId: string;
	readonly accounts: Accounts;
	readonly mail: FakeEmailSender;
	readonly privacy: Privacy;
	readonly deps: PrivacyDeps;
	close(): void;
}

function seedAccountData(
	panel: PanelAccount,
	userId: string,
	hash: string,
	secondAppId: string
): void {
	const { db, clock } = panel.fixture.base;
	const now = clock.now();
	db.insert(account)
		.values({
			id: `acc_${userId}`,
			userId,
			accountId: userId,
			providerId: 'credential',
			password: hash
		})
		.run();
	for (const [index, appId] of [SEEDED_APP_ID, null].entries()) {
		db.insert(session)
			.values({
				id: `ses_${userId}_${String(index)}`,
				userId,
				token: `token-${userId}-${String(index)}`,
				expiresAt: new Date(now + 86_400_000),
				ipAddress: '203.0.113.9',
				userAgent: 'Prueba',
				appId,
				deviceName: appId === null ? null : 'Portátil',
				appVersion: appId === null ? null : '4.0.0',
				lastUsedAt: toEpochMs(now)
			})
			.run();
	}
	for (const appId of [SEEDED_APP_ID, secondAppId]) {
		db.insert(userAppActivity)
			.values({ userId, appId, firstLoginAt: toEpochMs(now), lastUsedAt: toEpochMs(now) })
			.run();
		db.insert(syncDocuments)
			.values({ userId, appId, revision: 3, data: { nota: `dato de ${userId} en ${appId}` } })
			.run();
	}
	db.insert(verification)
		.values({
			id: `ver_reset_${userId}`,
			identifier: `reset-password:token-${userId}`,
			value: userId,
			expiresAt: new Date(now + 3_600_000)
		})
		.run();
	db.insert(verification)
		.values({
			id: `ver_email_${userId}`,
			identifier: `email-change:hash-${userId}`,
			value: JSON.stringify({
				userId,
				newEmail: 'nueva@ejemplo.es',
				normalized: 'nueva@ejemplo.es'
			}),
			expiresAt: new Date(now + 3_600_000)
		})
		.run();
}

/** Cuenta del panel y una segunda cuenta, con todos los datos que el borrado y la exportación deben tratar. */
export async function privacyFixture(): Promise<PrivacyFixture> {
	const panel = panelAccountFixture();
	const { db, logger, clock, credits } = panel.fixture.base;
	const ids = createIdGenerator(seededRandomBytes(61));
	const appsDeps = { db, logger, clock, ids };
	const secondAppId = addSecondApp(appsTestContext(db, 71));
	// La cuenta del panel acaba con deuda y sin saldo (deuda y saldo positivo no coexisten). La segunda es la del saldo:
	// bienvenida y una compra con saldo, una reserva abierta y perfil fiscal.
	const { userId: otherUserId, waiverId } = panel.fixture.addAccount(OTHER_USER_ID);
	credits.grantWelcome({ userId: otherUserId, emailNormalizedHash: 'hash-otra' });
	const purchase = panel.fixture.payments.purchase({
		userId: otherUserId,
		role: 'user',
		attemptId: 'att_otra',
		packId: 'pck_seed_5eur',
		wantsFullInvoice: false,
		withdrawalAcceptanceId: waiverId
	});
	if (purchase.status !== 'completed')
		throw new Error('la compra de la segunda cuenta debía completarse');
	const hold = credits.reserve({
		userId: otherUserId,
		appId: SEEDED_APP_ID,
		operationId: insertInFlightOperation(db, { userId: otherUserId }),
		amountMicro: 1_000_000
	});
	if (!hold.ok) throw new Error('la reserva de la segunda cuenta debía caber');
	const saved = panel.fixture.deps.invoicing.saveBillingProfile({
		userId: otherUserId,
		profile: PANEL_USER
	});
	if (saved.status !== 'saved')
		throw new Error('el perfil fiscal de la segunda cuenta debía guardarse');

	const hash = await hashPassword(PRIVACY_PASSWORD);
	seedAccountData(panel, panel.userId, hash, secondAppId);
	seedAccountData(panel, otherUserId, hash, secondAppId);

	const legal = { db, logger, ids };
	const now = toEpochMs(clock.now());
	for (const userId of [panel.userId, otherUserId]) {
		const versions = currentVersions(legal, now, ['terms', 'privacy', 'aup']);
		immediateTransaction(db, (tx) =>
			recordAcceptances(tx, legal, {
				userId,
				appId: SEEDED_APP_ID,
				ip: '203.0.113.9',
				now,
				accepted: [...versions].map(([document, current]) => ({
					document,
					version: current.version
				}))
			})
		);
	}

	const mail = createFakeEmailSender();
	const accounts = createAccounts({
		db,
		logger,
		clock,
		ids,
		captcha: createFakeCaptchaVerifier('valid'),
		notifications: {
			sender: mail,
			logger,
			supportEmail: () => 'soporte@mardomingo.com'
		},
		apps: appsDeps,
		legal,
		credits,
		emailHashKey: EMAIL_HASH_KEY,
		adminEmail: null,
		authSecret: 'secreto-de-prueba-de-al-menos-32-caracteres',
		publicWebUrl: 'https://cuenta.mardomingo.test'
	});
	const sync: SyncDeps = {
		db,
		clock,
		logger,
		apps: appsDeps,
		audit: { clock, ids, logger }
	};
	const deps: PrivacyDeps = {
		db,
		logger,
		clock,
		apps: appsDeps,
		accounts,
		credits,
		sync,
		legal,
		invoicing: panel.fixture.deps.invoicing,
		payments: panel.fixture.payments,
		notifications: { sender: mail, logger, supportEmail: () => 'soporte@mardomingo.com' },
		publicWebUrl: 'https://cuenta.mardomingo.test'
	};
	return {
		panel,
		userId: panel.userId,
		otherUserId,
		secondAppId,
		accounts,
		mail,
		privacy: createPrivacy(deps),
		deps,
		close: () => {
			panel.fixture.close();
		}
	};
}
