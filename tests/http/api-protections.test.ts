// Protecciones de IA contra el build (T208; BE-FR-43, BE-FR-46; SC-015). Usa una cuenta propia (`httpRateToken`) para que
// sus límites no afecten a `api-ai-chat`. El freno se activa escribiendo su estado en la base, que el servidor lee en cada
// petición; al terminar se borra. El límite de la app antes que el de la cuenta (V14), la transcripción simultánea y el
// `X-Forwarded-For` quedan fuera de esta suite: su estado depende de otra configuración o de un servidor en staging.
import Database from 'better-sqlite3';
import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest';
import { send } from './client';

const baseUrl = inject('httpBaseUrl');
const rateToken = inject('httpRateToken');
const appLimitToken = inject('httpAppLimitToken');
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

function jsonHeaders(extra: Readonly<Record<string, string>> = {}): Record<string, string> {
	return {
		'content-type': 'application/json',
		accept: 'application/json',
		'x-app-id': 'secretario',
		'x-app-version': '4.0.0',
		...extra
	};
}

/** Intento de login con credenciales erróneas desde una IP (la que decide la cabecera de proxy, con XFF_DEPTH=1). */
const failingLogin = (forwardedFor: string, email = 'nadie@ejemplo.es') =>
	send(baseUrl, '/api/v1/auth/login', {
		method: 'POST',
		host: apiHost,
		headers: jsonHeaders({ 'x-forwarded-for': forwardedFor }),
		body: JSON.stringify({ email, password: 'contraseña-incorrecta-1' })
	});

const resendFrom = (forwardedFor: string) =>
	send(baseUrl, '/api/v1/auth/resend-verification', {
		method: 'POST',
		host: apiHost,
		headers: jsonHeaders({ 'x-forwarded-for': forwardedFor }),
		body: JSON.stringify({ email: 'nadie@ejemplo.es' })
	});

describe('límites por IP de login y reenvío contra el build (BE-FR-45)', () => {
	it('la 31.ª petición de login desde una IP responde 429 con Retry-After de hasta 15 min', async () => {
		// Un correo distinto en cada intento: con el mismo correo, el bloqueo por email (BE-FR-67) respondería 429 antes.
		for (let index = 0; index < 30; index += 1) {
			const attempt = await failingLogin('203.0.113.50', `persona${String(index)}@ejemplo.es`);
			expect(attempt.status).not.toBe(429);
		}

		const limited = await failingLogin('203.0.113.50', 'otra@ejemplo.es');

		expect(limited.status).toBe(429);
		expect(parse(limited.text)).toMatchObject({ error: { code: 'RATE_LIMITED' } });
		const retryAfter = Number(limited.headers['retry-after']);
		expect(retryAfter).toBeGreaterThan(0);
		expect(retryAfter).toBeLessThanOrEqual(900);
	});

	it('el sexto reenvío en la hora desde una IP responde 429 con Retry-After de una hora', async () => {
		for (let index = 0; index < 5; index += 1) {
			expect((await resendFrom('203.0.113.51')).status).toBe(202);
		}

		const limited = await resendFrom('203.0.113.51');

		expect(limited.status).toBe(429);
		expect(parse(limited.text)).toMatchObject({ error: { code: 'RATE_LIMITED' } });
		expect(Number(limited.headers['retry-after'])).toBeGreaterThan(3500);
	});

	it('un X-Forwarded-For falsificado por la izquierda no cambia la IP contada', async () => {
		for (let index = 0; index < 5; index += 1) {
			expect((await resendFrom('203.0.113.52')).status).toBe(202);
		}

		const spoofed = await resendFrom('198.51.100.7, 203.0.113.52');

		expect(spoofed.status).toBe(429);
	});
});

describe('límite de la app antes que el de la cuenta (V14, BE-FR-43)', () => {
	let savedOverrides: string | null = null;

	beforeAll(() => {
		clearBrake();
		const sqlite = new Database(databasePath);
		try {
			const current: unknown = sqlite
				.prepare("SELECT settings_overrides FROM apps WHERE slug = 'secretario'")
				.pluck()
				.get();
			savedOverrides = typeof current === 'string' ? current : null;
			const merged = { ...parse(savedOverrides ?? '{}'), ai_requests_per_minute: 3 };
			sqlite
				.prepare("UPDATE apps SET settings_overrides = ? WHERE slug = 'secretario'")
				.run(JSON.stringify(merged));
		} finally {
			sqlite.close();
		}
	});

	afterAll(() => {
		const sqlite = new Database(databasePath);
		try {
			sqlite
				.prepare("UPDATE apps SET settings_overrides = ? WHERE slug = 'secretario'")
				.run(savedOverrides ?? '{}');
		} finally {
			sqlite.close();
		}
	});

	it('con el límite de la app en 3, la cuarta petición de la cuenta responde 429 aunque la cuenta lleve pocas', async () => {
		const appAccountChat = () =>
			send(baseUrl, '/api/v1/ai/chat', {
				method: 'POST',
				host: apiHost,
				headers: { ...jsonHeaders(), authorization: `Bearer ${appLimitToken}` },
				body
			});

		for (let index = 0; index < 3; index += 1) {
			expect((await appAccountChat()).status).toBe(200);
		}

		const limited = await appAccountChat();

		expect(limited.status).toBe(429);
		expect(parse(limited.text)).toMatchObject({ error: { code: 'RATE_LIMITED' } });
	});
});
