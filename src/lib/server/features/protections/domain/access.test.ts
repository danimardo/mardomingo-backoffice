// Reglas de acceso de `protections` (FR-073, FR-074, BE-FR-47, BE-FR-48 CA1, D-19; T190). Puro.
import { describe, expect, it } from 'vitest';
import { ENDPOINT_CHECKS, maintenanceVerdict, versionVerdict } from './access';

describe('ENDPOINT_CHECKS (api-v1 1.8, D-19)', () => {
	it('logout y /app/status no exigen versión mínima ni mantenimiento', () => {
		expect(ENDPOINT_CHECKS['auth.logout']).toEqual({ version: false, maintenance: false });
		expect(ENDPOINT_CHECKS['app.status']).toEqual({ version: false, maintenance: false });
	});

	it('login, /me, la aceptación de términos y /defaults no se bloquean por mantenimiento', () => {
		for (const endpoint of ['auth.login', 'me', 'me.accept_terms', 'defaults'] as const) {
			expect(ENDPOINT_CHECKS[endpoint].maintenance).toBe(false);
		}
	});

	it('/defaults exige versión, pero /sync y /ai bloquean por mantenimiento y por versión', () => {
		expect(ENDPOINT_CHECKS.defaults).toEqual({ version: true, maintenance: false });
		expect(ENDPOINT_CHECKS.sync).toEqual({ version: true, maintenance: true });
		expect(ENDPOINT_CHECKS.ai).toEqual({ version: true, maintenance: true });
	});
});

describe('versionVerdict', () => {
	const exigida = { enforce: true, minAppVersion: '4.2.0' };

	it('con enforce_version, una versión menor que la mínima o ausente es UPGRADE_REQUIRED', () => {
		expect(versionVerdict({ endpoint: 'ai', appVersion: '4.1.9', ...exigida })).toEqual({
			ok: false,
			reason: 'upgrade_required'
		});
		expect(versionVerdict({ endpoint: 'ai', appVersion: null, ...exigida })).toEqual({
			ok: false,
			reason: 'upgrade_required'
		});
	});

	it('una versión mínima mal formada también exige actualizar', () => {
		expect(
			versionVerdict({ endpoint: 'ai', appVersion: '4.2.0', enforce: true, minAppVersion: '4.2' })
		).toEqual({
			ok: false,
			reason: 'upgrade_required'
		});
	});

	it('una versión igual o mayor pasa', () => {
		expect(versionVerdict({ endpoint: 'ai', appVersion: '4.2.0', ...exigida })).toEqual({
			ok: true
		});
		expect(versionVerdict({ endpoint: 'ai', appVersion: '5.0.0', ...exigida })).toEqual({
			ok: true
		});
	});

	it('sin enforce_version no se exige nada', () => {
		expect(
			versionVerdict({ endpoint: 'ai', appVersion: null, enforce: false, minAppVersion: '4.2.0' })
		).toEqual({
			ok: true
		});
	});

	it('los endpoints exentos de versión (logout, /app/status) pasan siempre', () => {
		expect(versionVerdict({ endpoint: 'auth.logout', appVersion: null, ...exigida })).toEqual({
			ok: true
		});
		expect(versionVerdict({ endpoint: 'app.status', appVersion: '1.0.0', ...exigida })).toEqual({
			ok: true
		});
	});
});

describe('maintenanceVerdict', () => {
	const off = { active: false, message: '' };

	it('sin mantenimiento, todos pasan', () => {
		expect(maintenanceVerdict({ endpoint: 'ai', global: off, app: off })).toEqual({ ok: true });
	});

	it('el mantenimiento global bloquea y su mensaje tiene prioridad sobre el de la app', () => {
		expect(
			maintenanceVerdict({
				endpoint: 'ai',
				global: { active: true, message: 'Mantenimiento global' },
				app: { active: true, message: 'Mantenimiento de la app' }
			})
		).toEqual({ ok: false, reason: 'maintenance_global', message: 'Mantenimiento global' });
	});

	it('el mantenimiento de la app bloquea con su mensaje', () => {
		expect(
			maintenanceVerdict({
				endpoint: 'sync',
				global: off,
				app: { active: true, message: 'Actualizando' }
			})
		).toEqual({ ok: false, reason: 'maintenance_app', message: 'Actualizando' });
	});

	it('los endpoints exentos de mantenimiento pasan aunque esté activo', () => {
		const on = { active: true, message: 'Mantenimiento' };
		expect(maintenanceVerdict({ endpoint: 'auth.login', global: on, app: on })).toEqual({
			ok: true
		});
		expect(maintenanceVerdict({ endpoint: 'defaults', global: on, app: on })).toEqual({ ok: true });
		expect(maintenanceVerdict({ endpoint: 'me.accept_terms', global: on, app: on })).toEqual({
			ok: true
		});
	});
});
