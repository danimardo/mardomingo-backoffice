import { describe, expect, it } from 'vitest';
import { ID_PREFIXES, createIdGenerator, type IdKind } from './ids';

// Bytes fijos: hacen el generador determinista en los tests (Historias.md 15.22).
const fixedBytes = (length: number) => new Uint8Array(length).fill(0xff);

describe('generador de ids', () => {
	it('antepone el prefijo de la entidad y genera un cuerpo de 20 caracteres', () => {
		const next = createIdGenerator(fixedBytes);

		const id = next('app');
		expect(id.startsWith('app_')).toBe(true);
		expect(id.slice(ID_PREFIXES.app.length)).toHaveLength(20);
	});

	it('usa solo el alfabeto sin caracteres ambiguos', () => {
		const next = createIdGenerator(fixedBytes);

		const body = next('op').slice(ID_PREFIXES.op.length);
		expect(body).toMatch(/^[23456789abcdefghijkmnpqrstuvwxyz]+$/);
	});

	it('es determinista con bytes fijos', () => {
		const first = createIdGenerator(fixedBytes)('tpl');
		const second = createIdGenerator(fixedBytes)('tpl');

		expect(first).toBe(second);
	});

	it('produce ids distintos con bytes distintos', () => {
		let counter = 0;
		const sequence = (length: number) => {
			counter += 1;
			return new Uint8Array(length).fill(counter);
		};
		const next = createIdGenerator(sequence);

		expect(next('pay')).not.toBe(next('pay'));
	});

	it('genera identificadores únicos con la fuente criptográfica por defecto', () => {
		const next = createIdGenerator();
		const ids = new Set(Array.from({ length: 1000 }, () => next('mov')));

		expect(ids.size).toBe(1000);
	});

	it('tiene un prefijo para cada entidad propia de data-model 1.3', () => {
		const kinds: readonly IdKind[] = [
			'app',
			'aop',
			'tpl',
			'ldoc',
			'tac',
			'fx',
			'bkt',
			'hld',
			'mov',
			'inv',
			'pck',
			'pay',
			'op',
			'ann',
			'aud'
		];
		for (const kind of kinds) {
			expect(ID_PREFIXES[kind]).toMatch(/^[a-z]+_$/);
		}
		expect(Object.keys(ID_PREFIXES)).toHaveLength(kinds.length);
	});
});
