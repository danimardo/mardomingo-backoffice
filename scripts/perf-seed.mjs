/* eslint-disable no-restricted-globals -- script de laboratorio fuera de la aplicación: lee el catálogo del simulador con fetch. */
// Siembra para la prueba de carga (T274, T370; quickstart): crea una base SQLite migrada con las migraciones reales de
// `drizzle/` y la configuración mínima para usar el chat: la app `secretario`, su operación `improve` activa, los documentos
// legales vigentes, cuentas con contraseña y aceptaciones, bolsas de bienvenida y el catálogo de modelos del simulador de
// OpenRouter. Semilla fija: dos ejecuciones dan los mismos datos.
// Uso: MOCK_OPENROUTER_URL=<url del simulador> node scripts/perf-seed.mjs <ruta-de-la-base> [cuentas=20]
// No pasa por la aplicación: los valores replican lo que dejan los servicios en el seed de E2E.
import { createHash } from 'node:crypto';
import { mkdirSync, rmSync } from 'node:fs';
import { dirname } from 'node:path';
import { hashPassword } from 'better-auth/crypto';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';

const target = process.argv[2];
const accounts = Number(process.argv[3] ?? 20);
const mockUrl = process.env.MOCK_OPENROUTER_URL;
if (!target || !mockUrl) {
	console.error(
		'Uso: MOCK_OPENROUTER_URL=<url> node scripts/perf-seed.mjs <ruta-de-la-base> [cuentas=20]'
	);
	process.exit(1);
}

/** Contraseña de las cuentas de carga (no es un secreto: solo existe en la base de pruebas). */
const PERF_PASSWORD = 'contraseña-carga-123';
const SEED = 20261022;
const LEGAL_VERSION = '2026-10-11';
const LEGAL_DOCUMENTS = ['terms', 'privacy', 'aup', 'cookies', 'withdrawal_waiver'];
const REQUIRED_ACCEPTANCES = ['terms', 'privacy', 'aup'];

/** Generador determinista (xorshift32): la misma semilla da siempre los mismos importes. */
function random(state) {
	let x = state;
	return () => {
		x ^= x << 13;
		x ^= x >>> 17;
		x ^= x << 5;
		x >>>= 0;
		return x / 0x100000000;
	};
}

const catalogResponse = await fetch(new URL('/api/v1/models', mockUrl));
if (!catalogResponse.ok)
	throw new Error(`el simulador no responde el catálogo: ${String(catalogResponse.status)}`);
const catalog = (await catalogResponse.json()).data;

mkdirSync(dirname(target), { recursive: true });
rmSync(target, { force: true });
const sqlite = new Database(target);
sqlite.pragma('journal_mode = WAL');
const db = drizzle(sqlite);
migrate(db, { migrationsFolder: 'drizzle' });

const next = random(SEED);
const now = Date.UTC(2026, 9, 22, 9, 0, 0);
const password = await hashPassword(PERF_PASSWORD);

const insertUser = sqlite.prepare(
	"INSERT INTO user (id, name, email, email_normalized, email_verified, role, created_at, updated_at) VALUES (?, ?, ?, ?, 1, 'user', ?, ?)"
);
const insertAccount = sqlite.prepare(
	"INSERT INTO account (id, user_id, account_id, provider_id, password, created_at, updated_at) VALUES (?, ?, ?, 'credential', ?, ?, ?)"
);
const insertBucket = sqlite.prepare(
	"INSERT INTO credit_buckets (id, user_id, kind, source, initial_micro, remaining_micro, expires_at, simulated, created_at) VALUES (?, ?, 'free', 'welcome', ?, ?, ?, 0, ?)"
);
const insertAcceptance = sqlite.prepare(
	'INSERT INTO terms_acceptances (id, user_id, document, version, accepted_at, ip, app_id) VALUES (?, ?, ?, ?, ?, NULL, NULL)'
);

sqlite.transaction(() => {
	// Configuración de la app y del chat: los mismos valores que deja el seed de E2E.
	sqlite
		.prepare(
			`INSERT INTO apps (id, slug, name, description, client_types, status, links, min_app_version, recommended_app_version,
				enforce_version, maintenance_active, maintenance_message, allowed_origins, post_verify_text, settings_overrides,
				sync_schema, support_email, created_at, updated_at)
			 VALUES ('app_secretario', 'secretario', 'Secretario AI', '', '["desktop"]', 'active',
				'{"landing":{"type":"internal"},"download_url":"https://github.com/danimardo/secretario2/releases/latest/download/SecretarioAI-Setup.exe","release_notes_url":null}', '4.0.0', '4.0.0', 1, 0, '', '[]', NULL,
				'{"max_audio_seconds":300,"audio_duration_tolerance_seconds":10,"max_audio_mb":10}',
				'{"categories":{"customReplacements":{"strategy":"items","key":"from","tombstone_ttl_days":30},"coreReplacements":{"strategy":"block"},"quickTexts":{"strategy":"block"},"prompts":{"strategy":"block"},"preferences":{"strategy":"keyed","keys":["communicationStyle","messageType","language","targetPersons","processWithLLM","autoCopy","fixAuto","markdownMode","translationTargetLanguage","themePreference"]}}}', NULL, ?, ?)`
		)
		.run(now, now);
	sqlite
		.prepare(
			`INSERT INTO app_operations (id, app_id, key, name, kind, mode, model, fallback_models, temperature_milli,
				max_output_tokens, max_cost_micro, timeout_ms, capabilities, limits, group_label, active, created_at, updated_at)
			 VALUES ('aop_secretario_improve', 'app_secretario', 'improve', 'Procesar', 'chat', 'libre',
				'mistralai/mistral-small', '[]', 700, 8192, 12000000, 45000,
				'{"image_input":false,"structured_output":false,"tools":false}', '{}', 'Corrector', 1, ?, ?)`
		)
		.run(now, now);

	for (const document of LEGAL_DOCUMENTS) {
		const content = `Documento de prueba de carga: ${document}`;
		sqlite
			.prepare(
				`INSERT INTO legal_documents (id, document, version, content, content_hash, requires_reacceptance, published_at, created_by, created_at)
				 VALUES (?, ?, ?, ?, ?, ?, ?, NULL, ?)`
			)
			.run(
				`lgl_${document}_${LEGAL_VERSION}`,
				document,
				LEGAL_VERSION,
				content,
				createHash('sha256').update(content).digest('hex'),
				REQUIRED_ACCEPTANCES.includes(document) ? 1 : 0,
				now,
				now
			);
	}

	// Catálogo de modelos del simulador: precios en µUSD por millón de tokens (USD por token × 10^12).
	const insertModel = sqlite.prepare(
		'INSERT INTO model_cache (model_id, pricing, modalities, supported_parameters, fetched_at) VALUES (?, ?, ?, ?, ?)'
	);
	for (const model of catalog) {
		insertModel.run(
			model.id,
			JSON.stringify({
				inputPerMTokMicroUsd: Math.round(Number(model.pricing.prompt) * 1e12),
				outputPerMTokMicroUsd: Math.round(Number(model.pricing.completion) * 1e12)
			}),
			JSON.stringify(model.architecture.input_modalities),
			JSON.stringify(model.supported_parameters),
			now
		);
	}

	for (let index = 0; index < accounts; index += 1) {
		const suffix = String(index).padStart(3, '0');
		const id = `usr_perf_${suffix}`;
		const email = `carga${String(index)}@ejemplo.test`;
		insertUser.run(id, `Cuenta de carga ${String(index)}`, email, email, now, now);
		insertAccount.run(`acc_${id}`, id, id, password, now, now);
		const initial = 1_000_000_000 + Math.floor(next() * 500_000_000);
		insertBucket.run(`bkt_perf_${suffix}`, id, initial, initial, now + 30 * 86_400_000, now);
		for (const document of REQUIRED_ACCEPTANCES) {
			insertAcceptance.run(`acc_${document}_${id}`, id, document, LEGAL_VERSION, now);
		}
	}
})();

const count = sqlite.prepare('SELECT COUNT(*) AS n FROM user').get();
console.log(
	JSON.stringify({ database: target, accounts: count.n, models: catalog.length, seed: SEED })
);
sqlite.close();
