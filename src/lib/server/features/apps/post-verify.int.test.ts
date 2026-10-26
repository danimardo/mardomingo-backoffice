// Texto de pasos siguientes de la app de origen contra SQLite real (BE-FR-64 CA2; UX-03).
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
	addSecondApp,
	appsTestContext,
	type AppsTestContext
} from '../../../../../tests/builders/apps';
import { creditsFixture, type CreditsFixture } from '../../../../../tests/builders/credits';
import { postVerifyTextOf, type AppsDeps } from './index';

let fixture: CreditsFixture;
let ctx: AppsTestContext;
let deps: AppsDeps;

beforeEach(() => {
	fixture = creditsFixture(Date.UTC(2026, 9, 11, 8, 0, 0));
	ctx = appsTestContext(fixture.db);
	deps = { db: fixture.db, logger: fixture.logger, clock: fixture.clock, ids: ctx.deps.ids };
});

afterEach(() => {
	fixture.close();
});

describe('texto de pasos siguientes de la app de origen (BE-FR-64 CA2)', () => {
	it('[UX-03] devuelve el nombre y el texto propio de la app', () => {
		const appId = addSecondApp(ctx, {
			slug: 'con-texto',
			postVerifyText: 'Descarga la app e inicia sesión con tu email.'
		});

		expect(postVerifyTextOf(deps, appId)).toMatchObject({
			postVerifyText: 'Descarga la app e inicia sesión con tu email.'
		});
	});

	it('una app sin texto propio devuelve null, y una app inexistente no devuelve nada', () => {
		const appId = addSecondApp(ctx, { slug: 'sin-texto', postVerifyText: null });

		expect(postVerifyTextOf(deps, appId)?.postVerifyText).toBeNull();
		expect(postVerifyTextOf(deps, 'app_no_existe')).toBeUndefined();
	});
});
