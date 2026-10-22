/* eslint-disable no-restricted-globals -- script de laboratorio fuera de la aplicación: llama a la URL indicada con fetch directo. */
// Carga de laboratorio (T274; quickstart): N sesiones que recorren las páginas públicas con una pausa de ~5 s entre peticiones,
// durante un tiempo fijo. Informa de p50, p95, máximo y errores. Contra un servidor ya levantado.
// Uso: node scripts/perf-load.mjs <URL-base> [sesiones=1] [segundos=60] [pausa-ms=5000]
const base = process.argv[2];
const sessions = Number(process.argv[3] ?? 1);
const seconds = Number(process.argv[4] ?? 60);
const pauseMs = Number(process.argv[5] ?? 5000);
if (!base) {
	console.error(
		'Uso: node scripts/perf-load.mjs <URL-base> [sesiones=1] [segundos=60] [pausa-ms=5000]'
	);
	process.exit(1);
}

const PATHS = ['/', '/precios', '/api/v1/health'];
const samples = [];
let errors = 0;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function session(index) {
	const until = Date.now() + seconds * 1000;
	let step = index % PATHS.length;
	while (Date.now() < until) {
		const path = PATHS[step % PATHS.length];
		const started = performance.now();
		try {
			const response = await fetch(new URL(path, base), { redirect: 'manual' });
			await response.arrayBuffer();
			if (response.status >= 500) errors += 1;
		} catch {
			errors += 1;
		}
		samples.push(performance.now() - started);
		step += 1;
		await sleep(pauseMs);
	}
}

function percentile(sorted, p) {
	if (sorted.length === 0) return null;
	const index = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1);
	return Math.round(sorted[index] * 10) / 10;
}

await Promise.all(Array.from({ length: sessions }, (_, index) => session(index)));
const sorted = [...samples].sort((a, b) => a - b);
console.log(
	JSON.stringify({
		base,
		sessions,
		seconds,
		pauseMs,
		requests: samples.length,
		errors,
		p50Ms: percentile(sorted, 50),
		p95Ms: percentile(sorted, 95),
		maxMs: sorted.length === 0 ? null : Math.round(sorted[sorted.length - 1] * 10) / 10
	})
);
