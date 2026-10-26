// W03 · `/precios` (contracts/web-routes.md W03; BE-FR-73, FR-037). Costes típicos orientativos por operación, en créditos y
// agrupados por app. Público y sin acciones; nunca expone el modelo ni el coste real (los convierte `pricing`).
import { getComposition } from '$lib/server/composition.cache';
import { publicPricePage } from '$lib/server/features/pricing';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = () => publicPricePage(getComposition().pricing);
