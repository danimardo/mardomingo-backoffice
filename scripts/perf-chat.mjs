/* eslint-disable no-restricted-globals -- script de laboratorio fuera de la aplicación: llama a la URL indicada con fetch directo. */
// Carga de chat (T370; quickstart): cada sesión inicia sesión con su cuenta de carga (`carga{N}@ejemplo.test`, sembradas
// por scripts/perf-seed.mjs) y llama a `POST /api/v1/ai/chat` con la operación `improve` durante un tiempo fijo. Informa de
// p50, p95, máximo, códigos de estado y errores. Contra un servidor ya levantado con la base sembrada y el simulador de
// OpenRouter. No comprueba las reservas: eso lo hace scripts/perf-reservas.mjs sobre la base.
// Uso: node scripts/perf-chat.mjs <URL-base> [sesiones=1] [segundos=60] [pausa-ms=2000] [contraseña]

const base = process.argv[2];
const sessions = Number(process.argv[3] ?? 1);
const seconds = Number(process.argv[4] ?? 60);
const pauseMs = Number(process.argv[5] ?? 2000);
const password = process.argv[6] ?? 'contraseña-carga-123';
if (!base || !Number.isInteger(sessions) || sessions < 1) {
	console.error(
		'Uso: node scripts/perf-chat.mjs <URL-base> [sesiones=1] [segundos=60] [pausa-ms=2000] [contraseña]'
	);
	process.exit(1);
}

const APP_HEADERS = { 'x-app-id': 'secretario', 'x-app-version': '4.0.0' };
const samples = [];
const statuses = new Map();
const errorCodes = new Map();
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function count(map, key) {
	map.set(key, (map.get(key) ?? 0) + 1);
}

async function login(index) {
	const response = await fetch(new URL('/api/v1/auth/login', base), {
		method: 'POST',
		headers: {
			...APP_HEADERS,
			'content-type': 'application/json',
			'x-device-name': `carga-${String(index)}`
		},
		body: JSON.stringify({ email: `carga${String(index)}@ejemplo.test`, password })
	});
	const body = await response.json();
	if (!response.ok || typeof body.token !== 'string')
		throw new Error(`login de la sesión ${String(index)} con estado ${String(response.status)}`);
	return body.token;
}

async function session(index, token) {
	const until = Date.now() + seconds * 1000;
	let turn = 0;
	while (Date.now() < until) {
		turn += 1;
		const started = performance.now();
		try {
			const response = await fetch(new URL('/api/v1/ai/chat', base), {
				method: 'POST',
				headers: {
					...APP_HEADERS,
					authorization: `Bearer ${token}`,
					'content-type': 'application/json',
					'idempotency-key': crypto.randomUUID()
				},
				body: JSON.stringify({
					operation: 'improve',
					messages: [
						{
							role: 'user',
							content: `Mejora esta frase de prueba de carga ${String(index)}-${String(turn)}: hoy es un buen día para revisar el trabajo.`
						}
					]
				})
			});
			const text = await response.text();
			count(statuses, String(response.status));
			if (response.status >= 400) {
				const code = (() => {
					try {
						return JSON.parse(text).error?.code ?? 'SIN_CODIGO';
					} catch {
						return 'NO_JSON';
					}
				})();
				count(errorCodes, `${String(response.status)} ${code}`);
			}
		} catch (error) {
			count(statuses, 'red');
			count(errorCodes, error instanceof Error ? error.message.slice(0, 80) : 'error');
		}
		samples.push(performance.now() - started);
		await sleep(pauseMs);
	}
}

function percentile(sorted, p) {
	if (sorted.length === 0) return null;
	const index = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1);
	return Math.round(sorted[index] * 10) / 10;
}

const tokens = await Promise.all(Array.from({ length: sessions }, (_, index) => login(index)));
await Promise.all(tokens.map((token, index) => session(index, token)));
const sorted = [...samples].sort((a, b) => a - b);
console.log(
	JSON.stringify({
		base,
		sessions,
		seconds,
		pauseMs,
		requests: samples.length,
		statuses: Object.fromEntries(statuses),
		errorCodes: Object.fromEntries(errorCodes),
		p50Ms: percentile(sorted, 50),
		p95Ms: percentile(sorted, 95),
		maxMs: sorted.length === 0 ? null : Math.round(sorted[sorted.length - 1] * 10) / 10
	})
);
