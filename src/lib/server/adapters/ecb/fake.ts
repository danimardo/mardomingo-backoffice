// Fuente falsa del BCE para las pruebas (T149): devuelve el resultado que la prueba programa y cuenta las consultas.
import type { EcbFetch, FxSource } from './fx-source';

export interface FakeFxSource extends FxSource {
	readonly calls: number;
	next(result: EcbFetch): void;
}

export function createFakeFxSource(initial: EcbFetch = { status: 'empty' }): FakeFxSource {
	let result: EcbFetch = initial;
	let calls = 0;
	return {
		get calls() {
			return calls;
		},
		next(value) {
			result = value;
		},
		fetchLatest() {
			calls += 1;
			return Promise.resolve(result);
		}
	};
}
