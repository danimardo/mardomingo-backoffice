// Cabeceras comunes de la API (contracts/api-v1.md 1.2; T129): `X-App-Id` obligatorio y bien formado; `X-App-Version` y
// `X-Device-Name` opcionales, que se descartan si no encajan.
import { describe, expect, it } from 'vitest';
import { appHeadersOf } from './contract';

describe('appHeadersOf', () => {
	it('lee la app, la versión y el equipo cuando encajan', () => {
		const headers = new Headers({
			'x-app-id': 'secretario',
			'x-app-version': '4.0.12',
			'x-device-name': '  Portátil de Daniel  '
		});

		expect(appHeadersOf(headers)).toEqual({
			ok: true,
			appId: 'secretario',
			version: '4.0.12',
			deviceName: 'Portátil de Daniel'
		});
	});

	it('sin X-App-Id, no es válida', () => {
		expect(appHeadersOf(new Headers())).toEqual({ ok: false });
	});

	it('un X-App-Id mal formado no es válido', () => {
		for (const bad of ['Secretario', '-secretario', 'con espacio', 'a'.repeat(64)]) {
			expect(appHeadersOf(new Headers({ 'x-app-id': bad }))).toEqual({ ok: false });
		}
	});

	it('una versión mal formada se descarta sin rechazar la petición', () => {
		const result = appHeadersOf(new Headers({ 'x-app-id': 'secretario', 'x-app-version': '4.0' }));

		expect(result).toEqual({ ok: true, appId: 'secretario', version: null, deviceName: null });
	});

	it('un nombre de equipo con caracteres de control se descarta', () => {
		const result = appHeadersOf(
			new Headers({ 'x-app-id': 'secretario', 'x-device-name': 'PC\u0007' })
		);

		expect(result).toMatchObject({ ok: true, deviceName: null });
	});
});
