// Siembra para la prueba de carga (T274; quickstart): crea una base SQLite migrada con las migraciones reales de `drizzle/` y
// cuentas con bolsas de crédito, con semilla fija para que dos ejecuciones den los mismos datos.
// Uso: node scripts/perf-seed.mjs <ruta-de-la-base> [cuentas=20]
// No pasa por la aplicación: solo prepara datos. Las reservas bajo carga se comprueban en staging (T370).
import { mkdirSync, rmSync } from 'node:fs';
import { dirname } from 'node:path';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';

const target = process.argv[2];
const accounts = Number(process.argv[3] ?? 20);
if (!target) {
	console.error('Uso: node scripts/perf-seed.mjs <ruta-de-la-base> [cuentas=20]');
	process.exit(1);
}

const SEED = 20261022;
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

mkdirSync(dirname(target), { recursive: true });
rmSync(target, { force: true });
const sqlite = new Database(target);
sqlite.pragma('journal_mode = WAL');
const db = drizzle(sqlite);
migrate(db, { migrationsFolder: 'drizzle' });

const next = random(SEED);
const now = Date.UTC(2026, 9, 22, 9, 0, 0);
const insertUser = sqlite.prepare(
	"INSERT INTO user (id, name, email, email_verified, role, created_at, updated_at) VALUES (?, ?, ?, 1, 'user', ?, ?)"
);
const insertBucket = sqlite.prepare(
	"INSERT INTO credit_buckets (id, user_id, kind, source, initial_micro, remaining_micro, expires_at, simulated, created_at) VALUES (?, ?, 'free', 'welcome', ?, ?, ?, 0, ?)"
);

sqlite.transaction(() => {
	for (let index = 0; index < accounts; index += 1) {
		const id = `usr_perf_${String(index).padStart(3, '0')}`;
		insertUser.run(
			id,
			`Cuenta de carga ${String(index)}`,
			`carga${String(index)}@ejemplo.test`,
			now,
			now
		);
		const initial = 1_000_000_000 + Math.floor(next() * 500_000_000);
		insertBucket.run(
			`bkt_perf_${String(index).padStart(3, '0')}`,
			id,
			initial,
			initial,
			now + 30 * 86_400_000,
			now
		);
	}
})();

const count = sqlite.prepare('SELECT COUNT(*) AS n FROM user').get();
console.log(JSON.stringify({ database: target, accounts: count.n, seed: SEED }));
sqlite.close();
