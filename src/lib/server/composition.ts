// Composición de la aplicación (ARCHITECTURE.md §5): se construye una vez en `init`, con la configuración ya
// validada y el logger raíz. Las funcionalidades reciben sus dependencias por parámetro; nadie importa estado
// global salvo el contenedor de `composition.cache.ts`. Aquí se eligen los adaptadores según el entorno (T038):
// en `APP_ENV=test` el email va al _outbox_ de ficheros y, si hay simulador, a su URL; el captcha, a su simulador.
import type Database from 'better-sqlite3';
import type { RequestEvent } from '@sveltejs/kit';
import { createSystemClock, type Clock } from './adapters/clock/clock';
import { createFakeEmailSender } from './adapters/resend/fake-sender';
import type { EmailSender } from './adapters/resend/email-sender';
import { createResendSender } from './adapters/resend/resend-sender';
import { withOutbox } from './adapters/resend/outbox';
import { createTurnstileVerifier } from './adapters/turnstile/turnstile-verifier';
import { createEcbFxSource } from './adapters/ecb/ecb-fx-source';
import { createFakeInvoicing } from './adapters/invoicing/fake';
import { createNoneInvoicing } from './adapters/invoicing/none';
import type { InvoicingProvider } from './adapters/invoicing/provider';
import { createInvoicingService, type InvoicingService } from './features/invoicing';
import { createPaymentsService, type PaymentsService } from './features/payments';
import { createFakePaymentsProvider } from './adapters/payments/fake';
import { createSimulatedProvider } from './adapters/payments/simulated';
import type { PaymentsProvider } from './adapters/payments/provider';
import { createOpenRouterGateway } from './adapters/openrouter/openrouter';
import type { CaptchaVerifier } from './adapters/turnstile/captcha-verifier';
import { createAccounts, type Accounts } from './features/accounts';
import type { AiDeps } from './features/ai';
import type { MediaDeps } from './features/ai/media';
import { createMistralTranscriber } from './adapters/mistral/transcriber';
import { createFfprobe } from './adapters/ffprobe/prober';
import { createFfmpeg } from './adapters/ffmpeg/converter';
import { tmpdir } from 'node:os';
import type { AuditDeps } from './features/audit';
import type { SyncDeps } from './features/sync';
import { supportEmail, type AppsDeps } from './features/apps';
import { createCredits, type Credits } from './features/credits';
import { createProtectionsRuntime } from './features/protections';
import { type PricingDeps } from './features/pricing';
import type { LegalDeps } from './features/legal';
import type { AlertDeps, NotificationsDeps } from './features/notifications';
import type { Env } from './config/env-schema';
import { openDatabase, type Db } from './db/client';
import type { Logger } from './logging/logger';
import { createIdGenerator, type IdGenerator } from './shared/ids';

const TURNSTILE_ENDPOINT = 'https://challenges.cloudflare.com';
const OUTBOX_DIR = '.outbox';
const ECB_ENDPOINT = 'https://data-api.ecb.europa.eu';
const OPENROUTER_ENDPOINT = 'https://openrouter.ai';
const MISTRAL_ENDPOINT = 'https://api.mistral.ai';

export interface Composition {
	readonly config: Env;
	readonly logger: Logger;
	readonly clock: Clock;
	readonly ids: IdGenerator;
	readonly db: Db;
	readonly sqlite: Database.Database;
	readonly accounts: Accounts;
	readonly apps: AppsDeps;
	readonly legal: LegalDeps;
	readonly sync: SyncDeps;
	readonly credits: Credits;
	readonly pricing: PricingDeps;
	readonly paymentsProvider: PaymentsProvider;
	readonly invoicingProvider: InvoicingProvider;
	readonly invoicing: InvoicingService;
	readonly payments: PaymentsService;
	readonly ai: AiDeps;
	readonly media: MediaDeps;
	close(): void;
}

export interface CompositionOptions {
	/** Solo en la web: permite a Better Auth escribir la cookie de sesión desde las actions. */
	readonly requestEvent?: () => RequestEvent;
}

function emailSenderFor(config: Env, clock: Clock): EmailSender {
	if (config.APP_ENV !== 'test') {
		return createResendSender({ apiKey: config.RESEND_API_KEY, from: config.EMAIL_FROM });
	}
	const inner =
		config.MOCK_RESEND_URL === undefined
			? createFakeEmailSender()
			: createResendSender({
					apiKey: config.RESEND_API_KEY === '' ? 're_test' : config.RESEND_API_KEY,
					from: config.EMAIL_FROM,
					baseUrl: config.MOCK_RESEND_URL
				});
	return withOutbox(inner, { dir: OUTBOX_DIR, now: () => clock.now() });
}

function captchaFor(config: Env): CaptchaVerifier {
	return createTurnstileVerifier({
		secret: config.TURNSTILE_SECRET,
		endpoint: config.MOCK_TURNSTILE_URL ?? TURNSTILE_ENDPOINT
	});
}

export function createComposition(
	config: Env,
	logger: Logger,
	options: CompositionOptions = {}
): Composition {
	const { sqlite, db } = openDatabase(config.DATABASE_PATH);
	const clock = createSystemClock();
	const ids = createIdGenerator();

	const apps: AppsDeps = { db, logger, clock, ids };
	const legal: LegalDeps = { db, logger, ids };
	const sync: SyncDeps = { db, clock, logger, apps, audit: { clock, ids, logger } };
	const credits = createCredits({
		db,
		logger,
		clock,
		ids,
		apps,
		auditDeps: { clock, ids, logger }
	});
	const sender = emailSenderFor(config, clock);
	const notifications: NotificationsDeps = {
		sender,
		logger,
		supportEmail: () => supportEmail(apps)
	};
	const accounts = createAccounts({
		db,
		logger,
		clock,
		ids,
		captcha: captchaFor(config),
		notifications,
		apps,
		legal,
		credits,
		emailHashKey: config.EMAIL_HASH_KEY,
		adminEmail: config.ADMIN_EMAIL ?? null,
		authSecret: config.BETTER_AUTH_SECRET,
		publicWebUrl: config.PUBLIC_WEB_URL,
		...(options.requestEvent === undefined ? {} : { requestEvent: options.requestEvent })
	});

	const auditDeps: AuditDeps = { clock, ids, logger };
	const alerts: AlertDeps = {
		db,
		logger,
		clock,
		sender,
		adminEmail: () => config.ADMIN_EMAIL ?? null,
		supportEmail: () => supportEmail(apps)
	};
	// Proveedores de pagos y de facturación (BE-FR-24, BE-FR-75; T230, T231). Lo que no existe en la v4 falla al arrancar.
	if (config.PAYMENTS_PROVIDER !== 'simulated') {
		throw new Error('PAYMENTS_PROVIDER=stripe no está implementado en la v4 (BE-FR-29)');
	}
	if (config.INVOICING_PROVIDER === 'fake' && config.APP_ENV !== 'test') {
		throw new Error('INVOICING_PROVIDER=fake solo se admite con APP_ENV=test');
	}
	const paymentsProvider: PaymentsProvider =
		config.APP_ENV === 'test' ? createFakePaymentsProvider() : createSimulatedProvider();
	const invoicingProvider: InvoicingProvider =
		config.INVOICING_PROVIDER === 'fake' ? createFakeInvoicing() : createNoneInvoicing();
	const pricing: PricingDeps = {
		db,
		logger,
		clock,
		ids,
		apps,
		audit: auditDeps,
		alerts,
		fxSource: createEcbFxSource({ endpoint: config.MOCK_BCE_URL ?? ECB_ENDPOINT })
	};
	const ai: AiDeps = {
		db,
		protections: createProtectionsRuntime(),
		logger,
		clock,
		ids,
		apps,
		credits,
		pricing,
		alerts,
		gateway: createOpenRouterGateway({
			baseUrl: config.MOCK_OPENROUTER_URL ?? OPENROUTER_ENDPOINT,
			apiKey: config.OPENROUTER_API_KEY
		})
	};

	const invoicing = createInvoicingService({ db, logger, clock, ids, provider: invoicingProvider });
	const payments = createPaymentsService({
		db,
		logger,
		clock,
		ids,
		appEnv: config.APP_ENV,
		apps,
		provider: paymentsProvider,
		credits,
		invoicing,
		legal,
		auditDeps
	});

	const media: MediaDeps = {
		transcriber:
			config.MISTRAL_API_KEY === '' && config.MOCK_MISTRAL_URL === undefined
				? null
				: createMistralTranscriber({
						baseUrl: config.MOCK_MISTRAL_URL ?? MISTRAL_ENDPOINT,
						apiKey: config.MISTRAL_API_KEY === '' ? 'clave-de-prueba' : config.MISTRAL_API_KEY
					}),
		prober: createFfprobe(),
		converter: createFfmpeg(),
		tempRoot: tmpdir()
	};

	return {
		config,
		logger,
		clock,
		ids,
		db,
		sqlite,
		accounts,
		apps,
		legal,
		sync,
		credits,
		pricing,
		paymentsProvider,
		invoicingProvider,
		invoicing,
		payments,
		ai,
		media,
		close: () => {
			sqlite.close();
		}
	};
}
