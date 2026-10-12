// Comprobaciones previas de las rutas de sincronización (BE-FR-47, BE-FR-70 CA1, D-19; T218). Viven en la capa de API porque
// componen varias funcionalidades: `sync` no puede depender de `legal` ni de `protections`.
import { getComposition } from '$lib/server/composition.cache';
import { guardAccess } from '$lib/server/features/protections';
import { pendingAcceptancesOf } from '$lib/server/features/legal';
import { AppError } from '$lib/server/shared/errors';

/** Versión mínima y mantenimiento del endpoint, como en el resto de la API (api-v1 1.8). */
export function guardEndpoint(
	endpoint: 'sync' | 'defaults',
	app: { readonly id: string; readonly version: string | null }
): void {
	const composition = getComposition();
	guardAccess(
		{ apps: composition.apps, logger: composition.logger },
		{ endpoint, appId: app.id, appVersion: app.version }
	);
}

/** Documentos legales pendientes: `TERMS_ACCEPTANCE_REQUIRED` (403) con la lista (BE-FR-70). */
export function requireAcceptedTerms(userId: string): void {
	const composition = getComposition();
	const pending = pendingAcceptancesOf(composition.db, userId, composition.clock.now());
	if (pending.length === 0) return;
	composition.logger.emit('legal.acceptance.required', { count: pending.length });
	throw new AppError('TERMS_ACCEPTANCE_REQUIRED', {
		pending: pending.map((item) => ({ document: item.document, version: item.version }))
	});
}
