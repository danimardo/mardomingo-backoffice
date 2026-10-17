// Preparación de las operaciones de transcripción e imagen en la base del servidor construido (T187). Las operaciones se
// siembran inactivas y las activa el administrador (L13); aquí es una precondición de las pruebas HTTP. Los retrasos de
// reintento de Voxtral se ponen a cero para que un fallo del simulador responda al instante; los 2, 4 y 8 s se prueban
// en la integración con temporizador falso.
import { and, eq } from 'drizzle-orm';
import type { Db } from '$lib/server/db/client';
import { appOperations } from '$lib/server/features/apps/schema';
import { toMicro } from '$lib/shared/money';
import { SEEDED_APP_ID } from '../setup/integration.global-setup';

export const TRANSCRIPTION_OPERATION = 'transcription';
export const IMAGE_OPERATION = 'image-generation';

/**
 * Tope de la imagen de prueba: con los valores aprobados (T079) cada imagen cuesta ~155 créditos y el tope es de 80, así que
 * toda imagen se rechazaría. El hallazgo queda en el informe para decisión del propietario.
 */
const IMAGE_TEST_MAX_COST_MICRO = 200_000_000;

export function prepareMediaOperations(db: Db): void {
	const where = (key: string) =>
		and(eq(appOperations.appId, SEEDED_APP_ID), eq(appOperations.key, key));
	db.update(appOperations).set({ active: true }).where(where(TRANSCRIPTION_OPERATION)).run();
	db.update(appOperations)
		.set({ active: true, maxCostMicro: toMicro(IMAGE_TEST_MAX_COST_MICRO) })
		.where(where(IMAGE_OPERATION))
		.run();

	const row = db
		.select({ config: appOperations.transcriptionConfig })
		.from(appOperations)
		.where(where(TRANSCRIPTION_OPERATION))
		.get();
	const config = row?.config;
	if (config === null || config === undefined)
		throw new Error('la transcripción no tiene configuración');
	db.update(appOperations)
		.set({
			transcriptionConfig: { ...config, primary: { ...config.primary, retry_delays_ms: [0, 0, 0] } }
		})
		.where(where(TRANSCRIPTION_OPERATION))
		.run();
}
