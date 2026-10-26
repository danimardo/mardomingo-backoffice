// Modelo de vista de `/panel/comprar` con claves exactas (T246; BE-FR-23–26, 49.2): el `load` se comprueba por HTTP contra el
// build, leyendo `__data.json` con `toStrictEqual`. Desviación documentada respecto a `makeRequestEvent` (ver T109 y T270).
import { describe, expect, inject, it } from 'vitest';
import { loginAsUser } from './admin-session';
import { send } from './client';

const baseUrl = inject('httpBaseUrl');
const databasePath = inject('httpDatabasePath');
const webHost = `localhost:${new URL(baseUrl).port}`;

type Json = Record<string, unknown>;

function isRecord(value: unknown): value is Json {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function decodeAt(flat: readonly unknown[], index: number): unknown {
	const entry: unknown = flat[index];
	if (!isRecord(entry)) {
		return Array.isArray(entry) ? entry.map((ref: unknown) => decodeRef(flat, ref)) : entry;
	}
	return Object.fromEntries(Object.entries(entry).map(([key, ref]) => [key, decodeRef(flat, ref)]));
}

function decodeRef(flat: readonly unknown[], ref: unknown): unknown {
	return typeof ref === 'number' && ref >= 0 ? decodeAt(flat, ref) : undefined;
}

async function pageData(path: string, cookie: string, marker: string): Promise<Json> {
	const [pathname = path, query] = path.split('?');
	const dataPath = `${pathname}/__data.json${query === undefined ? '' : `?${query}`}`;
	const result = await send(baseUrl, dataPath, { host: webHost, headers: { cookie } });
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

function recordAt(parent: Json, key: string): Json {
	const value = parent[key];
	if (!isRecord(value)) throw new Error(`«${key}» debía ser un objeto`);
	return value;
}

function recordsAt(parent: Json, key: string): Json[] {
	const value = parent[key];
	if (!Array.isArray(value)) throw new Error(`«${key}» debía ser una lista`);
	return value.map((item: unknown) => {
		if (!isRecord(item)) throw new Error(`«${key}» debía contener objetos`);
		return item;
	});
}

const sorted = (value: Json): string[] => Object.keys(value).sort();

describe('modelo de vista de la compra con claves exactas (T246)', () => {
	it('/panel/comprar: la lista de paquetes y el paso de confirmación exponen sus claves exactas', async () => {
		const session = await loginAsUser(baseUrl, databasePath, {
			id: 'usr_vista_compra',
			email: 'usr_vista_compra@ejemplo.es',
			password: 'contraseña-usr_vista_compra-123'
		});

		const data = await pageData('/panel/comprar?paquete=pck_seed_5eur', session.cookie, 'packs');

		expect(sorted(data)).toStrictEqual([
			'availability',
			'billingProfile',
			'intentId',
			'packs',
			'selected',
			'waiverText'
		]);
		expect(sorted(recordAt(data, 'availability'))).toStrictEqual(['canPurchase', 'reason']);
		expect(sorted(recordAt(data, 'waiverText'))).toStrictEqual(['version']);
		expect(sorted(recordAt(data, 'billingProfile'))).toStrictEqual(['complete']);
		const packKeys = ['bonusPct', 'creditsMicro', 'id', 'name', 'priceCents'];
		for (const pack of recordsAt(data, 'packs')) {
			expect(sorted(pack)).toStrictEqual(packKeys);
		}
		expect(sorted(recordAt(data, 'selected'))).toStrictEqual(packKeys);
	});
});
