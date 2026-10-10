// Catálogo de eventos (contracts/log-events.md 1.1): los códigos tienen la forma `prefijo.objeto.resultado` y su
// prefijo es el de su dueño (app, http, log o client en la infraestructura; el nombre de la funcionalidad en las demás).
import { describe, expect, it } from 'vitest';
import { LOG_EVENTS } from '$lib/server/logging/events';
import { CLIENT_LOG_EVENTS } from '$lib/logging/events';

const CODE_FORM = /^[a-z]+(\.[a-z_]+){1,3}$/;
const INFRA_PREFIXES = new Set(['app', 'http', 'log', 'client']);

describe('catálogo de eventos de log', () => {
	it('los códigos del servidor tienen forma y prefijo de infraestructura', () => {
		const codes = Object.keys(LOG_EVENTS);
		expect(codes.length).toBeGreaterThan(0);
		for (const code of codes) {
			expect(code, code).toMatch(CODE_FORM);
			expect(INFRA_PREFIXES.has(code.split('.')[0] ?? ''), code).toBe(true);
		}
	});

	it('los códigos del navegador usan el prefijo client', () => {
		for (const code of Object.keys(CLIENT_LOG_EVENTS)) {
			expect(code, code).toMatch(CODE_FORM);
			expect(code.startsWith('client.'), code).toBe(true);
		}
	});

	it('cada evento tiene un mensaje fijo no vacío', () => {
		for (const meta of Object.values(LOG_EVENTS)) {
			expect(meta.msg.length).toBeGreaterThan(0);
		}
	});
});
