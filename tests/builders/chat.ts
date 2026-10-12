// Constructor de pruebas de `ai` (T173): base SQLite migrada con la app sembrada, créditos de bienvenida, aceptación
// vigente de los documentos legales y un doble de OpenRouter en memoria. Así cada prueba del chat parte de un estado
// conocido, sin red ni proveedor real.
import { and, eq } from 'drizzle-orm';
import type { ChatContext, AiDeps, RetryPolicy } from '$lib/server/features/ai';
import { createProtectionsRuntime } from '$lib/server/features/protections';
import { createFakeAiGateway, type FakeAiGateway } from '$lib/server/adapters/openrouter/fake';
import { createFakeFxSource, type FakeFxSource } from '$lib/server/adapters/ecb/fake';
import {
	createFakeEmailSender,
	type FakeEmailSender
} from '$lib/server/adapters/resend/fake-sender';
import { appOperations } from '$lib/server/features/apps/schema';
import type { PricingDeps } from '$lib/server/features/pricing';
import { createIdGenerator } from '$lib/server/shared/ids';
import { toMicro } from '$lib/shared/money';
import { creditsFixture, type CreditsFixture } from './credits';
import {
	activateChatOperation,
	acceptCurrentLegal,
	CHAT_KEY,
	grantChatWelcome,
	type ChatAccountDeps
} from './chat-account';
import { seededRandomBytes } from './ids';
import { SEEDED_APP_ID } from '../setup/integration.global-setup';

export { CHAT_KEY } from './chat-account';
export const CHAT_MESSAGE = 'Hola, revisa este párrafo.';
/** Tope de coste de la operación sembrada (12 créditos). */
export const SEEDED_MAX_COST_MICRO = 12_000_000;
/** 1.000 créditos de bienvenida (BE-FR-12) en µc. */
export const WELCOME_MICRO = 1_000_000_000;

export interface ChatFixture {
	readonly base: CreditsFixture;
	readonly gateway: FakeAiGateway;
	readonly sender: FakeEmailSender;
	readonly fx: FakeFxSource;
	readonly deps: AiDeps;
	readonly userId: string;
	/** Contexto de una petición de `userId`; la señal es nueva salvo que se pase otra. */
	context(overrides?: Partial<ChatContext>): ChatContext;
	/** Cambia el tope de coste de la operación sembrada, para las pruebas de `OPERATION_TOO_EXPENSIVE`. */
	setOperationMaxCost(micro: number): void;
	close(): void;
}

export interface ChatFixtureOptions {
	/** Con aceptación legal vigente (por defecto). */
	readonly ready?: boolean;
	/** Con créditos de bienvenida (por defecto, igual que `ready`). */
	readonly welcome?: boolean;
	readonly retry?: RetryPolicy;
	readonly userId?: string;
}

/** Política rápida para las pruebas: un reintento sin espera. */
export const FAST_RETRY: RetryPolicy = { retries: 1, waitsMs: [0] };

export function chatFixture(options: ChatFixtureOptions = {}): ChatFixture {
	const base = creditsFixture(1_792_879_200_000);
	const ids = createIdGenerator(seededRandomBytes(77));
	const gateway = createFakeAiGateway();
	const sender = createFakeEmailSender();
	const fx = createFakeFxSource();
	const userId = base.addUser(options.userId ?? 'usr_chat');

	const account: ChatAccountDeps = { db: base.db, logger: base.logger, clock: base.clock, ids };
	activateChatOperation(base.db);
	if (options.welcome ?? options.ready ?? true) grantChatWelcome(account, userId);
	if (options.ready ?? true) acceptCurrentLegal(account, userId);

	const apps = { db: base.db, logger: base.logger, clock: base.clock, ids };
	const pricing: PricingDeps = {
		db: base.db,
		logger: base.logger,
		clock: base.clock,
		ids,
		apps,
		audit: { clock: base.clock, ids, logger: base.logger },
		alerts: {
			db: base.db,
			logger: base.logger,
			clock: base.clock,
			sender,
			adminEmail: () => 'admin@mardomingo.test',
			supportEmail: () => 'soporte@mardomingo.com'
		},
		fxSource: fx
	};
	const deps: AiDeps = {
		db: base.db,
		protections: createProtectionsRuntime(),
		logger: base.logger,
		clock: base.clock,
		ids,
		apps,
		credits: base.credits,
		pricing,
		gateway,
		alerts: pricing.alerts,
		retry: options.retry ?? FAST_RETRY
	};

	return {
		base,
		gateway,
		sender,
		fx,
		deps,
		userId,
		context(overrides = {}) {
			return {
				userId,
				appId: SEEDED_APP_ID,
				appTitle: 'Secretario AI',
				sessionId: null,
				appVersion: '4.0.0',
				idempotencyKey: null,
				signal: new AbortController().signal,
				...overrides
			};
		},
		setOperationMaxCost(micro: number) {
			base.db
				.update(appOperations)
				.set({ maxCostMicro: toMicro(micro) })
				.where(and(eq(appOperations.appId, SEEDED_APP_ID), eq(appOperations.key, CHAT_KEY)))
				.run();
		},
		close() {
			base.close();
		}
	};
}

/** Cuerpo de una petición de chat libre sobre la operación sembrada. */
export function chatBody(
	overrides: { operation?: string; messages?: { role: 'user'; content: string }[] } = {}
) {
	return {
		operation: overrides.operation ?? CHAT_KEY,
		messages: overrides.messages ?? [{ role: 'user' as const, content: CHAT_MESSAGE }]
	};
}
