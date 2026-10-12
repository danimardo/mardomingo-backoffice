// Protecciones de IA contra el build (T208; BE-FR-43, BE-FR-46; SC-015). Usa una cuenta propia (`httpRateToken`) para que
// sus límites no afecten a `api-ai-chat`. El freno se activa escribiendo su estado en la base, que el servidor lee en cada
// petición; al terminar se borra. El límite de la app antes que el de la cuenta (V14), la transcripción simultánea y el
// `X-Forwarded-For` quedan fuera de esta suite: su estado depende de otra configuración o de un servidor en staging.
import Database from 'better-sqlite3';
import { afterAll, describe, expect, inject, it } from 'vitest';
import { send } from './client';

const baseUrl = inject('httpBaseUrl');
const rateToken = inject('httpRateToken');
const databasePath = inject('httpDatabasePath');
const apiHost = new URL(baseUrl).host;

const headers = {
	'content-type': 'application/json',
	accept: 'application/json',
	'x-app-id': 'secretario',
	'x-app-version': '4.0.0',
	authorization: `Bearer ${rateToken}`
};

const body = JSON.stringify({
	operation: 'improve',
	messages: [{ role: 'user', content: 'Revisa este párrafo, por favor.' }]
});

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null;
}

function parse(text: string): Record<string, unknown> {
	const parsed: unknown = JSON.parse(text);
	return isRecord(parsed) ? parsed : {};
}

/** Día civil de Madrid de hoy, en el formato de `CivilDate`. */
function madridToday(): string {
	return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Madrid' }).format(new Date());
}

function setBrake(active: boolean): void {
	const sqlite = new Database(databasePath);
	try {
		const now = Date.now();
		const value = JSON.stringify({
			day: madridToday(),
			active,
			activatedAt: active ? now : null,
			releasedAt: null,
			releasedBy: null
		});
		sqlite
			.prepare(
				"INSERT INTO protection_state (key, value, updated_at) VALUES ('global_brake', ?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at"
			)
			.run(value, now);
	} finally {
		sqlite.close();
	}
}

function clearBrake(): void {
	const sqlite = new Database(databasePath);
	try {
		sqlite.prepare("DELETE FROM protection_state WHERE key = 'global_brake'").run();
	} finally {
		sqlite.close();
	}
}

const chat = () =>
	send(baseUrl, '/api/v1/ai/chat', { method: 'POST', host: apiHost, headers, body });

afterAll(() => {
	clearBrake();
});

describe('frecuencia por minuto contra el build (BE-FR-43)', () => {
	it('las 30 primeras peticiones del minuto pasan y la 31.ª responde 429 con Retry-After', async () => {
		for (let index = 0; index < 30; index += 1) {
			const ok = await chat();
			expect(ok.status).toBe(200);
		}

		const limited = await chat();

		expect(limited.status).toBe(429);
		expect(parse(limited.text)).toMatchObject({ error: { code: 'RATE_LIMITED' } });
		const retryAfter = Number(limited.headers['retry-after']);
		expect(retryAfter).toBeGreaterThan(0);
		expect(retryAfter).toBeLessThanOrEqual(60);
	});
});

describe('freno global contra el build (BE-FR-46)', () => {
	it('con el freno activo hoy, el chat de una cuenta sin compra responde 503 SERVICE_LIMITED', async () => {
		setBrake(true);

		const result = await chat();

		expect(result.status).toBe(503);
		expect(parse(result.text)).toMatchObject({ error: { code: 'SERVICE_LIMITED' } });
	});
});
