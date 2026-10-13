// Apps del panel contra SQLite real (T269; BE-FR-49.11): solo las activas, con su descripción y sus enlaces de descarga y de
// acceso cuando existen. Sin enlace configurado, el enlace sale nulo y la página dice que la descarga no está disponible.
import { eq } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { creditsFixture, type CreditsFixture } from '../../../../../tests/builders/credits';
import { SEEDED_APP_ID } from '../../../../../tests/setup/integration.global-setup';
import { activeAppsForPanel } from './service';
import { apps } from './schema';

let f: CreditsFixture;

beforeEach(() => {
	f = creditsFixture(Date.UTC(2026, 9, 11, 8, 0, 0));
});

afterEach(() => {
	f.close();
});

describe('activeAppsForPanel (BE-FR-49.11)', () => {
	it('lista la app sembrada con el enlace del instalador de la última versión y sin acceso externo', () => {
		const apps = activeAppsForPanel(f.deps.apps);

		expect(apps).toHaveLength(1);
		expect(apps[0]).toMatchObject({ id: SEEDED_APP_ID, name: 'Secretario AI', accessUrl: null });
		expect(apps[0]?.downloadUrl).toContain('SecretarioAI-Setup.exe');
	});

	it('una app inactiva no aparece', () => {
		f.db.update(apps).set({ status: 'disabled' }).where(eq(apps.id, SEEDED_APP_ID)).run();

		expect(activeAppsForPanel(f.deps.apps)).toEqual([]);
	});
});
