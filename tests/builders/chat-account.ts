// Preparación de una cuenta que puede usar el chat (T173, T178): operación de chat activa, aceptación vigente de los
// documentos legales y créditos de bienvenida. La usan el constructor de integración (`chat.ts`) y el global setup de
// las pruebas HTTP, que escriben en la base del servidor construido. Así las dos suites parten del mismo estado.
import { and, eq } from 'drizzle-orm';
import type { Clock } from '$lib/server/adapters/clock/clock';
import type { Db } from '$lib/server/db/client';
import { immediateTransaction } from '$lib/server/db/tx';
import { appOperations } from '$lib/server/features/apps/schema';
import { createCredits } from '$lib/server/features/credits';
import { currentVersions, recordAcceptances } from '$lib/server/features/legal';
import type { Logger } from '$lib/server/logging/logger';
import type { IdGenerator } from '$lib/server/shared/ids';
import { toEpochMs } from '$lib/shared/time';
import { SEEDED_APP_ID } from '../setup/integration.global-setup';

/** Operación de chat sembrada (corrector, libre, modelo principal y un respaldo; sin imagen, salida estructurada ni tools). */
export const CHAT_KEY = 'improve';

/** Dependencias mínimas para preparar una cuenta. */
export interface ChatAccountDeps {
	readonly db: Db;
	readonly logger: Logger;
	readonly clock: Clock;
	readonly ids: IdGenerator;
}

/**
 * Activa la operación de chat. Las operaciones se siembran inactivas y solo las activa el administrador (L13); aquí es una
 * precondición del escenario, no un paso del flujo que se prueba.
 */
export function activateChatOperation(db: Db): void {
	db.update(appOperations)
		.set({ active: true })
		.where(and(eq(appOperations.appId, SEEDED_APP_ID), eq(appOperations.key, CHAT_KEY)))
		.run();
}

/** Acepta la versión vigente de los tres documentos legales que exige el paso 9 de §8. */
export function acceptCurrentLegal(deps: ChatAccountDeps, userId: string): void {
	const now = toEpochMs(deps.clock.now());
	const versions = currentVersions({ db: deps.db }, now, ['terms', 'privacy', 'aup']);
	immediateTransaction(deps.db, (tx) => {
		recordAcceptances(
			tx,
			{ db: deps.db, logger: deps.logger, ids: deps.ids },
			{
				userId,
				appId: null,
				ip: null,
				now,
				accepted: [
					{ document: 'terms', version: versions.get('terms')?.version ?? '' },
					{ document: 'privacy', version: versions.get('privacy')?.version ?? '' },
					{ document: 'aup', version: versions.get('aup')?.version ?? '' }
				]
			}
		);
	});
}

/** Concede la bienvenida (1.000 créditos, BE-FR-12) a la cuenta, por el servicio de créditos. */
export function grantChatWelcome(deps: ChatAccountDeps, userId: string): void {
	const apps = { db: deps.db, logger: deps.logger, clock: deps.clock, ids: deps.ids };
	createCredits({
		...apps,
		apps,
		auditDeps: { clock: deps.clock, ids: deps.ids, logger: deps.logger }
	}).grantWelcome({ userId, emailNormalizedHash: `hash-${userId}` });
}
