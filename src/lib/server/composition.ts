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
import { createOpenRouterGateway } from './adapters/openrouter/openrouter';
import type { CaptchaVerifier } from './adapters/turnstile/captcha-verifier';
import { createAccounts, type Accounts } from './features/accounts';
import type { AiDeps } from './features/ai';
import type { AuditDeps } from './features/audit';
import { supportEmail, type AppsDeps } from './features/apps';
import { createCredits, type Credits } from './features/credits';
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
	readonly credits: Credits;
	readonly pricing: PricingDeps;
	readonly ai: AiDeps;
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
		credits,
		pricing,
		ai,
		close: () => {
			sqlite.close();
		}
	};
}
