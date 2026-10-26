// Modelo de vista de las páginas legales públicas W04–W07 (contracts/web-routes.md; BE-FR-60). Las cuatro rutas comparten
// esta lectura: el documento vigente o `404` si todavía no hay versión publicada.
import { error } from '@sveltejs/kit';
import { resolve } from '$app/paths';
import type { Composition } from '$lib/server/composition';
import { currentDocument, type LegalDocumentView } from '$lib/server/features/legal';

export type PublicLegalKind = 'terms' | 'privacy' | 'cookies' | 'aup';

export function legalPageOf(
	composition: Pick<Composition, 'legal' | 'clock'>,
	kind: PublicLegalKind
): { readonly document: LegalDocumentView } {
	const document = currentDocument(composition.legal, composition.clock.now(), kind);
	if (document === undefined) error(404);
	return { document };
}

/** Ruta pública del documento legal, o `null` si no tiene página propia (renuncia al desistimiento y declaración de edad). */
export function legalHrefOf(kind: string): string | null {
	switch (kind) {
		case 'terms':
			return resolve('/terminos');
		case 'privacy':
			return resolve('/privacidad');
		case 'cookies':
			return resolve('/cookies');
		case 'aup':
			return resolve('/uso-aceptable');
		default:
			return null;
	}
}
