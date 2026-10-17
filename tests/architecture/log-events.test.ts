// Catálogo de eventos (contracts/log-events.md 1.1): los códigos tienen la forma `prefijo.objeto.resultado` y su
// prefijo es el de su dueño (app, http, log o client en la infraestructura; el nombre de la funcionalidad en las demás).
import { describe, expect, it } from 'vitest';
import { LOG_EVENTS } from '$lib/server/logging/events';
import { CLIENT_LOG_EVENTS } from '$lib/logging/events';

const CODE_FORM = /^[a-z]+(\.[a-z_]+){1,3}$/;
const INFRA_PREFIXES = new Set(['app', 'http', 'log', 'client']);
// Las catorce funcionalidades de ARCHITECTURE.md §3: cada una usa su nombre como prefijo de sus eventos.
const FEATURE_PREFIXES = [
	'audit',
	'notifications',
	'apps',
	'legal',
	'pricing',
	'credits',
	'invoicing',
	'accounts',
	'payments',
	'sync',
	'protections',
	'ai',
	'privacy',
	'stats'
];
const SERVER_PREFIXES = new Set([...INFRA_PREFIXES, ...FEATURE_PREFIXES]);

describe('catálogo de eventos de log', () => {
	it('los códigos del servidor tienen forma y prefijo de infraestructura o de su funcionalidad', () => {
		const codes = Object.keys(LOG_EVENTS);
		expect(codes.length).toBeGreaterThan(0);
		for (const code of codes) {
			expect(code, code).toMatch(CODE_FORM);
			expect(SERVER_PREFIXES.has(code.split('.')[0] ?? ''), code).toBe(true);
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
