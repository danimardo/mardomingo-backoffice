// Visibilidad de un anuncio para una app (BE-FR-85 CA1–CA2, FR-076; T192). Puro.
import { describe, expect, it } from 'vitest';
import { isVisible, type AnnouncementRow } from './announcements';

const NOW = 2_000_000_000;

function row(overrides: Partial<AnnouncementRow> = {}): AnnouncementRow {
	return {
		id: 'ann_1',
		appId: null,
		level: 'info',
		message: 'Mantenimiento el sábado',
		link: null,
		startsAt: NOW - 1_000,
		endsAt: null,
		minVersion: null,
		maxVersion: null,
		active: true,
		...overrides
	};
}

const APP = { appId: 'app_1', version: '4.2.0', now: NOW };

describe('isVisible', () => {
	it('un anuncio activo, de todas las apps y vigente se ve', () => {
		expect(isVisible(row(), APP)).toBe(true);
	});

	it('un anuncio inactivo no se ve', () => {
		expect(isVisible(row({ active: false }), APP)).toBe(false);
	});

	it('un anuncio de otra app no se ve; uno de esta app sí', () => {
		expect(isVisible(row({ appId: 'app_2' }), APP)).toBe(false);
		expect(isVisible(row({ appId: 'app_1' }), APP)).toBe(true);
	});

	it('antes de empezar no se ve; empezando ahora sí', () => {
		expect(isVisible(row({ startsAt: NOW + 1 }), APP)).toBe(false);
		expect(isVisible(row({ startsAt: NOW }), APP)).toBe(true);
	});

	it('al llegar a su fin deja de verse (el fin es exclusivo)', () => {
		expect(isVisible(row({ endsAt: NOW + 1 }), APP)).toBe(true);
		expect(isVisible(row({ endsAt: NOW }), APP)).toBe(false);
	});

	it('con rango de versiones, se ve solo si la versión cae dentro (extremos inclusivos)', () => {
		expect(isVisible(row({ minVersion: '4.0.0', maxVersion: '4.2.0' }), APP)).toBe(true);
		expect(isVisible(row({ minVersion: '4.3.0' }), APP)).toBe(false);
		expect(isVisible(row({ maxVersion: '4.1.9' }), APP)).toBe(false);
	});

	it('sin versión, solo se ven los anuncios sin rango', () => {
		expect(isVisible(row(), { ...APP, version: null })).toBe(true);
		expect(isVisible(row({ minVersion: '4.0.0' }), { ...APP, version: null })).toBe(false);
	});
});
