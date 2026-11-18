// S-03 · W42 pierde el JSON escrito al fallar la validación (constitución, «Lo escrito no se pierde» y helper de formularios:
// «`values` reenvía lo escrito»; «los mensajes de error explican qué ha pasado, dónde»). La action devuelve
// `fail(400, { errors: { datos } })` o `failureOf(cause)` sin `values` (predeterminados/+page.server.ts:53-60), y la página pinta
// siempre `data.defaultsJson` del `load` (+page.svelte:28-30): el administrador pierde lo que editó. Además, el error de esquema no
// dice qué categoría falla (`verdict.field` se descarta).
// Copiar a: tests/http/admin-predeterminados-conserva-texto.test.ts
// Ejecutar (contra el build): pnpm build && pnpm exec vitest run --project http tests/http/admin-predeterminados-conserva-texto.test.ts
// Debe FALLAR hoy: la respuesta 400 no contiene el texto enviado.
import { beforeAll, describe, expect, inject, it } from 'vitest';
import { loginAsAdmin, postAdmin, type AdminSession } from './admin-session';

const baseUrl = inject('httpBaseUrl');
const databasePath = inject('httpDatabasePath');
const GUARDAR = '/admin/apps/secretario/predeterminados?/guardarPredeterminados';

let session: AdminSession;

beforeAll(async () => {
	session = await loginAsAdmin(baseUrl, databasePath, {
		id: 'usr_http_predet_texto_admin',
		email: 'admin.predet.texto.http@ejemplo.es',
		password: 'contraseña-predet-texto-123'
	});
});

describe('W42 conserva lo escrito al fallar (S-03)', () => {
	it('un JSON que no cumple el esquema responde 400 y vuelve a pintar lo escrito', async () => {
		const escrito =
			'{"quickTexts":{"value":["marcador-unico-s03"],"updatedAt":1},"categoriaInventadaS03":{}}';

		const result = await postAdmin(
			session,
			GUARDAR,
			`datos=${encodeURIComponent(escrito)}&motivo=${encodeURIComponent('Prueba S-03')}&confirmado=true`
		);

		expect(result.status).toBe(400);
		expect(result.text).toContain('marcador-unico-s03');
		expect(result.text).toContain('categoriaInventadaS03');
	});

	it('un JSON roto responde 400 y vuelve a pintar lo escrito', async () => {
		const escrito = '{"quickTexts": marcador-roto-s03';

		const result = await postAdmin(
			session,
			GUARDAR,
			`datos=${encodeURIComponent(escrito)}&motivo=${encodeURIComponent('Prueba S-03')}&confirmado=true`
		);

		expect(result.status).toBe(400);
		expect(result.text).toContain('marcador-roto-s03');
	});
});
