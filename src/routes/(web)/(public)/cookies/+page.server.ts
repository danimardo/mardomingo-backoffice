// W06 · `/cookies` (contracts/web-routes.md; BE-FR-60). Documento vigente, público y sin acciones.
import { getComposition } from '$lib/server/composition.cache';
import { legalPageOf } from '$lib/server/web/legal-page';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = () => legalPageOf(getComposition(), 'cookies');
