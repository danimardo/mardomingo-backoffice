// Modelos de vista del panel con claves exactas (T270; BE-FR-49, 15.15): el `load` de `/panel` y de `/panel/sesiones` se
// comprueba por HTTP contra el build, leyendo los datos que SvelteKit sirve en `__data.json`. Son la forma real que recibe la
// página: cualquier clave de más o de menos rompe la prueba. Desviación documentada respecto a `makeRequestEvent` (ver T109).
import { describe, expect, inject, it } from 'vitest';
import Database from 'better-sqlite3';
import { loginAsUser } from './admin-session';
import { send } from './client';

const baseUrl = inject('httpBaseUrl');
const databasePath = inject('httpDatabasePath');
const webHost = `localhost:${new URL(baseUrl).port}`;

type Json = Record<string, unknown>;

function isRecord(value: unknown): value is Json {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Decodifica el formato plano de devalue que usa SvelteKit: cada objeto o lista referencia índices del array. */
function decodeAt(flat: readonly unknown[], index: number): unknown {
	const entry: unknown = flat[index];
	if (!isRecord(entry)) {
		return Array.isArray(entry) ? entry.map((ref: unknown) => decodeRef(flat, ref)) : entry;
	}
	return Object.fromEntries(Object.entries(entry).map(([key, ref]) => [key, decodeRef(flat, ref)]));
}

/** Los valores negativos son códigos especiales de devalue (`undefined`, `NaN`…): aquí cuentan como ausentes. */
function decodeRef(flat: readonly unknown[], ref: unknown): unknown {
	return typeof ref === 'number' && ref >= 0 ? decodeAt(flat, ref) : undefined;
}

/** Datos de la página que contiene `marker`, decodificados desde `__data.json`. */
async function pageDataWith(path: string, cookie: string, marker: string): Promise<Json> {
	const result = await send(baseUrl, `${path}/__data.json`, { host: webHost, headers: { cookie } });
	expect(result.status).toBe(200);
	const body: unknown = JSON.parse(result.text);
	const nodes: unknown = isRecord(body) ? body.nodes : undefined;
	for (const node of Array.isArray(nodes) ? nodes : []) {
		if (!isRecord(node)) continue;
		const data: unknown = node.data;
		if (!Array.isArray(data)) continue;
		const root = decodeAt(data, 0);
		if (isRecord(root) && marker in root) return root;
	}
	throw new Error(`ninguna página de ${path} expone «${marker}»`);
}

/** Valor de una clave que debe ser un objeto; si no lo es, la prueba falla con un mensaje claro. */
function recordAt(parent: Json, key: string): Json {
	const value = parent[key];
	if (!isRecord(value)) throw new Error(`«${key}» debía ser un objeto`);
	return value;
}

/** Lista de objetos bajo una clave. */
function recordsAt(parent: Json, key: string): Json[] {
	const value = parent[key];
	if (!Array.isArray(value)) throw new Error(`«${key}» debía ser una lista`);
	return value.map((item: unknown) => {
		if (!isRecord(item)) throw new Error(`«${key}» debía contener objetos`);
		return item;
	});
}

const sorted = (value: Json): string[] => Object.keys(value).sort();

async function userWithChange(id: string, sql: string): Promise<string> {
	const session = await loginAsUser(baseUrl, databasePath, {
		id,
		email: `${id}@ejemplo.es`,
		password: `contraseña-${id}-123`
	});
	const db = new Database(databasePath);
	try {
		db.prepare(sql).run(id);
	} finally {
		db.close();
	}
	return session.cookie;
}

describe('modelos de vista del panel con claves exactas (T270)', () => {
	it('/panel: el resumen expone exactamente sus claves y las del saldo', async () => {
		const session = await loginAsUser(baseUrl, databasePath, {
			id: 'usr_vista_panel',
			email: 'usr_vista_panel@ejemplo.es',
			password: 'contraseña-usr_vista_panel-123'
		});

		const data = await pageDataWith('/panel', session.cookie, 'balance');

		expect(sorted(data)).toStrictEqual([
			'announcements',
			'balance',
			'buckets',
			'email',
			'lowBalance',
			'pendingAcceptances',
			'supportEmail',
			'welcome'
		]);
		expect(sorted(recordAt(data, 'balance'))).toStrictEqual([
			'availableMicro',
			'debtMicro',
			'eurCents',
			'freeMicro',
			'nextFreeExpiry',
			'paidMicro',
			'reservedMicro',
			'totalMicro'
		]);
		expect(sorted(recordAt(data, 'welcome'))).toStrictEqual(['status']);
		for (const bucket of recordsAt(data, 'buckets')) {
			expect(sorted(bucket)).toStrictEqual([
				'expiresOn',
				'kind',
				'remainingMicro',
				'simulated',
				'source'
			]);
		}
	});

	it('/panel/sesiones: la lista expone exactamente las claves de cada sesión', async () => {
		const session = await loginAsUser(baseUrl, databasePath, {
			id: 'usr_vista_sesiones',
			email: 'usr_vista_sesiones@ejemplo.es',
			password: 'contraseña-usr_vista_sesiones-123'
		});

		const data = await pageDataWith('/panel/sesiones', session.cookie, 'sessions');

		// `allClosed` es el aviso de UX-10 tras «Cerrar las demás sesiones».
		expect(sorted(data)).toStrictEqual(['allClosed', 'closed', 'sessions']);
		const sessions = recordsAt(data, 'sessions');
		expect(sessions.length).toBeGreaterThan(0);
		for (const item of sessions) {
			expect(sorted(item)).toStrictEqual([
				'approxIp',
				'createdOn',
				'current',
				'deviceName',
				'id',
				'lastUsedOn'
			]);
		}
	});
	it('sin verificar: el panel manda a reenviar la verificación', async () => {
		const cookie = await userWithChange(
			'usr_panel_sin_verificar',
			'UPDATE user SET email_verified = 0 WHERE id = ?'
		);
		const result = await send(baseUrl, '/panel', {
			host: webHost,
			headers: { cookie, accept: 'text/html' }
		});
		expect(result.status).toBe(303);
		expect(String(result.headers.location)).toContain('/verificar/reenviar');
	});

	it('bloqueado: el panel manda al login y no muestra datos', async () => {
		const cookie = await userWithChange(
			'usr_panel_bloqueado',
			'UPDATE user SET banned = 1 WHERE id = ?'
		);
		const result = await send(baseUrl, '/panel', {
			host: webHost,
			headers: { cookie, accept: 'text/html' }
		});
		expect(result.status).toBe(303);
		expect(String(result.headers.location)).toContain('/login');
	});
});
