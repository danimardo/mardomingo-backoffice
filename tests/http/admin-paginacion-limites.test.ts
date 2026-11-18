// A-07 (sospecha) · Una `pagina` enorme en los filtros GET del panel rompe la carga con 500 (UX-09: filtros y paginación en la
// URL; constitución, validación de entradas: un parámetro inválido se trata, no rompe la página). `Math.max(1,
// Number.parseInt(x, 10) || 1)` (admin/usuarios/+page.server.ts:19, admin/auditoria/+page.server.ts:30 y `pageNumber` en
// src/lib/shared/paging.ts:7-9) no pone tope: «1e400» escrito en cifras da `Infinity` y «100000000000000000000» da 1e20. El
// desplazamiento `(page - 1) * 25` o el límite `page * 20 + 1` llegan a SQLite como REAL no representable en 64 bits, que
// SQLite rechaza en LIMIT/OFFSET («datatype mismatch»), y la carga lanza.
//
// Destino en el repo: tests/http/admin-paginacion-limites.test.ts
// Ejecutar: pnpm build; pnpm exec vitest run --project http tests/http/admin-paginacion-limites.test.ts
// Debe FALLAR hoy si la sospecha se confirma: responde 500 en lugar de 200 (última página o lista vacía) o 400.
import { beforeAll, describe, expect, inject, it } from 'vitest';
import { loginAsAdmin, type AdminSession } from './admin-session';
import { send } from './client';

const baseUrl = inject('httpBaseUrl');
const databasePath = inject('httpDatabasePath');
const HUGE = '9'.repeat(400);
const OVER_INT64 = '100000000000000000000';

let admin: AdminSession;

beforeAll(async () => {
	admin = await loginAsAdmin(baseUrl, databasePath, {
		id: 'usr_http_a07_admin',
		email: 'admin.a07.http@ejemplo.es',
		password: 'contraseña-a07-http-123'
	});
});

function get(path: string) {
	return send(baseUrl, path, {
		host: admin.webHost,
		headers: { accept: 'text/html', cookie: admin.cookie }
	});
}

describe('A-07 · una página fuera de rango no rompe las listas del panel (UX-09)', () => {
	it.each([
		['/admin/usuarios?q=a&pagina=', HUGE],
		['/admin/usuarios?q=a&pagina=', OVER_INT64],
		['/admin/auditoria?pagina=', HUGE],
		['/admin/auditoria?pagina=', OVER_INT64],
		[`/admin/usuarios/usr_http_a07_admin?pag_movimientos=`, HUGE],
		[`/admin/usuarios/usr_http_a07_admin?pag_pagos=`, OVER_INT64]
	])('%s<%s> responde 200 o 400, nunca 500', async (path, value) => {
		const result = await get(`${path}${value}`);

		expect([200, 400]).toContain(result.status);
	});
});
