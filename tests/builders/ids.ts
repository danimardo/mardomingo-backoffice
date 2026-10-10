// Bytes pseudoaleatorios con semilla para que los ids de prueba sean reproducibles (T-TEST-003).
import type { RandomBytes } from '$lib/server/shared/ids';

export function seededRandomBytes(seed: number): RandomBytes {
	let state = seed >>> 0;
	return (length) => {
		const out = new Uint8Array(length);
		for (let index = 0; index < length; index += 1) {
			state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
			out[index] = state >>> 24;
		}
		return out;
	};
}
