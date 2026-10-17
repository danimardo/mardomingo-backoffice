// Comprobación manual de los topes de `secretario` (T079, BE-FR-72). Hace una llamada real por modelo a OpenRouter con
// el `max_tokens` aprobado y muestra si la respuesta se cortó, cuántos tokens usó y cuánto costó, para compararlo con la
// estimación de `apps/defaults.ts`. Requiere OPENROUTER_API_KEY en el entorno; la clave nunca se imprime.
//
// Uso (PowerShell):  $env:OPENROUTER_API_KEY = '...'; node scripts/verify-model-caps.mjs
// Uso (Git Bash):    OPENROUTER_API_KEY='...' node scripts/verify-model-caps.mjs

import { request } from 'node:https';

const KEY = process.env.OPENROUTER_API_KEY;
if (!KEY) {
	console.error('Falta OPENROUTER_API_KEY en el entorno.');
	process.exit(1);
}

const MAX_TOKENS = 8192;
const ENDPOINT = 'https://openrouter.ai/api/v1/chat/completions';

/** Modelos cuyo tope depende de `max_output_tokens`: el Corrector, el PRO y la transcripción de imagen. */
const MODELS = [
	{ id: 'openai/gpt-5.6-luna', inPerM: 0.2, outPerM: 1.2 },
	{ id: 'openai/gpt-5.6-sol', inPerM: 2, outPerM: 10 },
	{ id: 'anthropic/claude-haiku-5.5', inPerM: 0.1, outPerM: 0.5 },
	{ id: 'anthropic/claude-sonnet-5.5', inPerM: 2, outPerM: 10 }
];

// Tarea que pide una salida larga, para forzar el tope: reescribir un texto párrafo a párrafo, ampliándolo.
const PARAGRAPH =
	'La transición a un modelo de trabajo híbrido ha cambiado la forma en que los equipos se coordinan. Las reuniones ' +
	'presenciales se han reducido, pero las decisiones siguen necesitando contexto, y eso exige documentación clara, ' +
	'canales ordenados y responsables identificados. Sin esas bases, la productividad depende de quien tenga más ' +
	'disponibilidad, no de quien tenga más criterio.';
const INPUT = Array.from({ length: 24 }, () => PARAGRAPH).join('\n\n');
const PROMPT =
	'Reescribe el siguiente texto en español, párrafo a párrafo. Amplía cada párrafo con ejemplos concretos y conserva el ' +
	'sentido original. No omitas ningún párrafo.\n\n' +
	INPUT;

/** POST JSON con `node:https`; devuelve el código de estado y el cuerpo como texto. */
function postJson(url, headers, payload) {
	return new Promise((resolve, reject) => {
		const target = new URL(url);
		const req = request(
			{
				hostname: target.hostname,
				path: target.pathname,
				method: 'POST',
				headers: { ...headers, 'Content-Length': Buffer.byteLength(payload) }
			},
			(res) => {
				let text = '';
				res.setEncoding('utf8');
				res.on('data', (chunk) => {
					text += chunk;
				});
				res.on('end', () => {
					resolve({ status: res.statusCode ?? 0, text });
				});
			}
		);
		req.on('error', reject);
		req.setTimeout(120_000, () => {
			req.destroy(new Error('tiempo de espera agotado'));
		});
		req.write(payload);
		req.end();
	});
}

async function callModel(model) {
	const { status, text } = await postJson(
		ENDPOINT,
		{
			Authorization: `Bearer ${KEY}`,
			'Content-Type': 'application/json',
			'X-Title': 'verify-model-caps'
		},
		JSON.stringify({
			model: model.id,
			max_tokens: MAX_TOKENS,
			messages: [{ role: 'user', content: PROMPT }],
			usage: { include: true }
		})
	);
	if (status !== 200) {
		return { model: model.id, error: `HTTP ${String(status)}` };
	}
	const body = JSON.parse(text);
	const choice = body.choices?.[0];
	const usage = body.usage ?? {};
	const promptTokens = usage.prompt_tokens ?? 0;
	const completionTokens = usage.completion_tokens ?? 0;
	const reasoningTokens = usage.completion_tokens_details?.reasoning_tokens ?? 0;
	const estimated = (promptTokens * model.inPerM + completionTokens * model.outPerM) / 1_000_000;
	return {
		model: model.id,
		finishReason: choice?.finish_reason ?? 'desconocido',
		promptTokens,
		completionTokens,
		reasoningTokens,
		realCostUsd: typeof usage.cost === 'number' ? usage.cost : null,
		estimatedCostUsd: estimated
	};
}

const results = [];
for (const model of MODELS) {
	results.push(await callModel(model));
}

console.log(`Tope de salida probado: ${String(MAX_TOKENS)} tokens`);
console.log('');
for (const r of results) {
	if (r.error) {
		console.log(`${r.model}: ERROR ${r.error}`);
		continue;
	}
	const truncated = r.finishReason === 'length' ? 'SÍ, se cortó en el tope' : 'no';
	const cost = r.realCostUsd === null ? 'no informado' : `${r.realCostUsd.toFixed(5)} USD`;
	console.log(`${r.model}`);
	console.log(`  cortada: ${truncated} (finish_reason=${r.finishReason})`);
	console.log(
		`  tokens: entrada ${String(r.promptTokens)}, salida ${String(r.completionTokens)}, razonamiento ${String(r.reasoningTokens)}`
	);
	console.log(
		`  coste real: ${cost} | estimado con la tarifa: ${r.estimatedCostUsd.toFixed(5)} USD`
	);
	console.log('');
}
console.log(
	'Si alguna respuesta sale cortada, sube max_output_tokens o revisa el razonamiento antes de activar.'
);
