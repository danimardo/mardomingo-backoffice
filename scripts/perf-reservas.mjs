// Comprobación de reservas tras una carga de chat (T370; BE-FR-30–34): sobre una copia de la base SQLite, verifica que
// nada queda a medias y que el dinero cuadra. Sale con código 1 si hay alguna incidencia.
//   1. Por cuenta, lo consumido de las bolsas (sum(initial - remaining)) es igual a lo cobrado (sum(charged_micro)).
//   2. No quedan reservas abiertas (credit_holds con released_at NULL) ni operaciones en `in_progress`.
//   3. Ningún saldo de bolsa es negativo ni supera su importe inicial.
// Uso: node scripts/perf-reservas.mjs <ruta-de-la-base>
import { DatabaseSync } from 'node:sqlite';

const target = process.argv[2];
if (!target) {
	console.error('Uso: node scripts/perf-reservas.mjs <ruta-de-la-base>');
	process.exit(1);
}

const db = new DatabaseSync(target, { readOnly: true });
const issues = [];

const perUser = db
	.prepare(
		`SELECT u.id AS user_id,
			COALESCE((SELECT SUM(b.initial_micro) - SUM(b.remaining_micro) FROM credit_buckets b WHERE b.user_id = u.id), 0) AS consumed,
			COALESCE((SELECT SUM(o.charged_micro) FROM ai_operations o WHERE o.user_id = u.id), 0) AS charged,
			(SELECT COUNT(*) FROM ai_operations o WHERE o.user_id = u.id) AS operations
		FROM user u
		WHERE u.id IN (SELECT user_id FROM credit_buckets)`
	)
	.all();

let mismatched = 0;
for (const row of perUser) {
	if (row.consumed !== row.charged) {
		mismatched += 1;
		issues.push(
			`${row.user_id}: consumido ${String(row.consumed)} != cobrado ${String(row.charged)}`
		);
	}
}

const openHolds = db
	.prepare('SELECT COUNT(*) AS n FROM credit_holds WHERE released_at IS NULL')
	.get().n;
if (openHolds > 0) issues.push(`reservas abiertas: ${String(openHolds)}`);

const inProgress = db
	.prepare("SELECT COUNT(*) AS n FROM ai_operations WHERE status = 'in_progress'")
	.get().n;
if (inProgress > 0) issues.push(`operaciones en in_progress: ${String(inProgress)}`);

const badBuckets = db
	.prepare(
		'SELECT COUNT(*) AS n FROM credit_buckets WHERE remaining_micro < 0 OR remaining_micro > initial_micro'
	)
	.get().n;
if (badBuckets > 0) issues.push(`bolsas fuera de rango: ${String(badBuckets)}`);

const totals = db
	.prepare(
		`SELECT (SELECT COUNT(*) FROM ai_operations) AS operations,
			(SELECT COUNT(*) FROM ai_operations WHERE status = 'ok') AS ok,
			(SELECT COALESCE(SUM(charged_micro), 0) FROM ai_operations) AS charged,
			(SELECT COUNT(*) FROM credit_holds) AS holds`
	)
	.get();

console.log(
	JSON.stringify({
		target,
		accounts: perUser.length,
		mismatchedAccounts: mismatched,
		openHolds,
		inProgress,
		badBuckets,
		totals,
		issues: issues.slice(0, 20),
		verdict: issues.length === 0 ? 'OK' : 'INCIDENCIAS'
	})
);
db.close();
process.exit(issues.length === 0 ? 0 : 1);
