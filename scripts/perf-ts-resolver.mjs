// Resolvedor de Node para ejecutar los simuladores de `tests/mock-servers` fuera de Vitest (T370): los imports relativos
// sin extensión se resuelven a `.ts`. No añade dependencias; lo registra `scripts/perf-mock-openrouter.mjs`.
export async function resolve(specifier, context, nextResolve) {
	try {
		return await nextResolve(specifier, context);
	} catch (error) {
		if (specifier.startsWith('.') && !/\.[cm]?[jt]s$/.test(specifier)) {
			return nextResolve(`${specifier}.ts`, context);
		}
		throw error;
	}
}
