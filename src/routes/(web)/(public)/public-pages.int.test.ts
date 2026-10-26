// Composición de los modelos de vista de las páginas públicas W01–W07 contra SQLite real (T352; BE-FR-59, BE-FR-60, BE-FR-73).
// Los `load` no se ejecutan en los tests de datos: se prueban las funciones que componen, con claves exactas
// (`toStrictEqual`) para que ningún campo interno llegue a una página pública.
import { eq } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { appsTestContext, addOperation, chatOperation } from '../../../../tests/builders/apps';
import { creditsFixture, type CreditsFixture } from '../../../../tests/builders/credits';
import { apps, appOperations } from '$lib/server/features/apps/schema';
import {
	appPageOf,
	landingListOf,
	type LandingAppRow,
	landingRowBySlug,
	landingRows,
	supportEmail
} from '$lib/server/features/apps';
import { legalDocuments } from '$lib/server/features/legal/schema';
import { currentDocument } from '$lib/server/features/legal';
import { priceReferences } from '$lib/server/features/pricing/schema';
import { publicPricePage, type PricingDeps } from '$lib/server/features/pricing';
import { legalPageOf } from '$lib/server/web/legal-page';
import { toMicro } from '$lib/shared/money';
import { toEpochMs } from '$lib/shared/time';
import { SEEDED_APP_ID } from '../../../../tests/setup/integration.global-setup';
import { pricingDepsOf } from '../../../../tests/builders/pricing';

const NOW = Date.UTC(2026, 9, 19, 9, 0, 0);

let fixture: CreditsFixture;
let pricing: PricingDeps;

beforeEach(() => {
	// El reloj va después de la semilla de documentos legales (que se siembra con la hora real del arranque): así la versión sembrada ya es vigente.
	fixture = creditsFixture(Date.now());
	pricing = pricingDepsOf(fixture);
});

afterEach(() => {
	fixture.close();
});

/** Fila de la app sembrada; falla con un mensaje claro si el montaje no la trae. */
function seededRow(): LandingAppRow {
	const row = landingRowBySlug(fixture.db, 'secretario');
	if (row === undefined) throw new Error('la app secretario debía estar sembrada');
	return row;
}

describe('landings (W01 y W02)', () => {
	it('la app sembrada aparece en la landing con las claves exactas y la descarga permanente', () => {
		const list = landingListOf(landingRows(fixture.db));
		expect(list).toHaveLength(1);
		expect(Object.keys(list[0] ?? {}).sort()).toStrictEqual([
			'description',
			'landing',
			'name',
			'slug'
		]);
		expect(list[0]).toMatchObject({
			slug: 'secretario',
			name: 'Secretario AI',
			landing: { kind: 'internal', url: null }
		});

		const page = appPageOf(seededRow(), supportEmail(pricing.apps));
		expect(Object.keys(page).sort()).toStrictEqual([
			'app',
			'disabled',
			'registerHref',
			'supportEmail'
		]);
		expect(Object.keys(page.app).sort()).toStrictEqual([
			'access',
			'clientTypes',
			'description',
			'download',
			'externalLanding',
			'name',
			'slug',
			'smartScreenHelp'
		]);
		expect(page.registerHref).toBe('/registro?app=secretario');
		expect(page.app.download?.available).toBe(true);
		expect(page.app.smartScreenHelp).toBe(true);
	});

	it('ninguna app activa: lista vacía; la app desactivada se muestra sin descarga ni alta', () => {
		fixture.db.update(apps).set({ status: 'disabled' }).where(eq(apps.slug, 'secretario')).run();

		expect(landingListOf(landingRows(fixture.db))).toStrictEqual([]);
		const page = appPageOf(seededRow(), 'soporte@mardomingo.com');
		expect(page.disabled).toBe(true);
		expect(page.registerHref).toBeNull();
		expect(page.app.download).toBeNull();
	});

	it('app con landing externa y app sin descarga', () => {
		fixture.db
			.update(apps)
			.set({
				links: {
					landing: { type: 'external', url: 'https://secretario.example/' },
					download_url: null
				}
			})
			.where(eq(apps.slug, 'secretario'))
			.run();

		expect(landingListOf(landingRows(fixture.db))[0]?.landing).toStrictEqual({
			kind: 'external',
			url: 'https://secretario.example/'
		});
		const page = appPageOf(seededRow(), 'soporte@mardomingo.com');
		expect(page.app.externalLanding).toBe('https://secretario.example/');
		expect(page.app.download).toStrictEqual({ url: null, available: false });
	});

	it('una app inexistente no tiene fila', () => {
		expect(landingRowBySlug(fixture.db, 'no-existe')).toBeUndefined();
	});
});

describe('precios orientativos (W03)', () => {
	function activeOnlyOperation(key: string): string {
		// Deja solo una operación activa para que el resultado sea determinista.
		fixture.db.update(appOperations).set({ active: false }).run();
		const ctx = appsTestContext(fixture.db);
		return addOperation(ctx, SEEDED_APP_ID, chatOperation(key, { name: 'Corregir texto' }));
	}

	it('sin costes típicos, la operación activa aparece sin valor ni origen', () => {
		activeOnlyOperation('corregir');

		const page = publicPricePage(pricing);
		expect(page.groups).toStrictEqual([
			{
				appName: 'Secretario AI',
				operations: [{ name: 'Corregir texto', typicalMicro: null, source: null }]
			}
		]);
		expect(page.computedOn).toBeNull();
	});

	it('el coste típico se publica en créditos y el valor manual manda sobre el calculado', () => {
		const operationId = activeOnlyOperation('corregir');
		fixture.db
			.insert(priceReferences)
			.values({
				operationId,
				typicalMicro: toMicro(400),
				source: 'auto',
				sampleSize: 80,
				computedAt: toEpochMs(NOW)
			})
			.run();

		const auto = publicPricePage(pricing).groups[0]?.operations[0];
		// 400 µUSD con comisión 5,5 %, tipo 0,92 y margen 2,0 a 1.000 créditos por euro: 0,776 créditos (BE-FR-22).
		expect(auto).toStrictEqual({ name: 'Corregir texto', typicalMicro: 776_480, source: 'auto' });

		fixture.db
			.update(priceReferences)
			.set({ manualTypicalMicro: toMicro(1_000) })
			.where(eq(priceReferences.operationId, operationId))
			.run();
		const manual = publicPricePage(pricing).groups[0]?.operations[0];
		expect(manual?.source).toBe('manual');
		expect(manual?.typicalMicro).toBe(1_941_200);
	});

	it('nunca expone el modelo ni el coste real', () => {
		const operationId = activeOnlyOperation('corregir');
		fixture.db
			.insert(priceReferences)
			.values({
				operationId,
				typicalMicro: toMicro(400),
				source: 'auto',
				sampleSize: 80,
				computedAt: toEpochMs(NOW)
			})
			.run();

		const text = JSON.stringify(publicPricePage(pricing));
		expect(text).not.toContain('modelo-a');
		expect(text).not.toContain('400');
	});

	it('los ejemplos legibles salen de la tarifa de transcripción vigente', () => {
		const page = publicPricePage(pricing);
		if (page.examples.dictationMinuteMicro !== null) {
			expect(page.examples.dictationMinuteMicro).toBeGreaterThan(0);
			expect(page.examples.hoursPerPack5EurTenths).toBeGreaterThan(0);
		} else {
			expect(page.examples.hoursPerPack5EurTenths).toBeNull();
		}
	});
});

describe('documentos legales (W04–W07)', () => {
	it('los cuatro documentos públicos tienen versión vigente con las claves exactas', () => {
		for (const kind of ['terms', 'privacy', 'cookies', 'aup'] as const) {
			const { document } = legalPageOf(
				{
					legal: { db: fixture.db, logger: fixture.logger, ids: pricing.ids },
					clock: fixture.clock
				},
				kind
			);
			expect(Object.keys(document).sort()).toStrictEqual([
				'contentHtml',
				'kind',
				'publishedOn',
				'version'
			]);
			expect(document.kind).toBe(kind);
			expect(document.contentHtml).toContain('<p>');
		}
	});

	it('un documento sin versión publicada responde 404', () => {
		fixture.db.delete(legalDocuments).where(eq(legalDocuments.document, 'cookies')).run();
		expect(() =>
			legalPageOf(
				{
					legal: { db: fixture.db, logger: fixture.logger, ids: pricing.ids },
					clock: fixture.clock
				},
				'cookies'
			)
		).toThrow(expect.objectContaining({ status: 404 }));
	});

	it('sirve la versión vigente (la más reciente ya publicada) y escapa el HTML del contenido', () => {
		const deps = { db: fixture.db };
		fixture.db
			.insert(legalDocuments)
			.values({
				id: 'doc_terms_nueva',
				document: 'terms',
				version: '2026-10-19',
				content: '# Nuevos términos\n\n<script>alert(1)</script> y **negrita**',
				contentHash: 'hash',
				requiresReacceptance: false,
				publishedAt: toEpochMs(NOW - 1_000),
				createdBy: null
			})
			.run();
		fixture.db
			.insert(legalDocuments)
			.values({
				id: 'doc_terms_futura',
				document: 'terms',
				version: '2026-12-01',
				content: 'Todavía no vigente',
				contentHash: 'hash2',
				requiresReacceptance: false,
				publishedAt: toEpochMs(NOW + 86_400_000),
				createdBy: null
			})
			.run();

		const view = currentDocument(deps, toEpochMs(NOW), 'terms');
		expect(view?.version).toBe('2026-10-19');
		expect(view?.publishedOn).toBe('2026-10-19');
		expect(view?.contentHtml).toBe(
			'<h1>Nuevos términos</h1>\n<p>&lt;script&gt;alert(1)&lt;/script&gt; y <strong>negrita</strong></p>'
		);
	});
});
