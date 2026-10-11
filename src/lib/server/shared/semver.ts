// Versiones `x.y.z` de la app y rangos inclusivos (BE-FR-48 CA1, BE-FR-85 CA1; T189). Puro: sin I/O ni dependencias.
// Solo se aceptan números; cualquier otra forma (prerelease, `v4`, `4.0`) se trata como inválida.

export interface Version {
	readonly major: number;
	readonly minor: number;
	readonly patch: number;
}

const VERSION = /^(\d+)\.(\d+)\.(\d+)$/;

/** Versión `x.y.z`, o `null` si no lo es (ausente, vacía o con otra forma). */
export function parseVersion(text: string | null): Version | null {
	if (text === null) return null;
	const match = VERSION.exec(text);
	if (match?.[1] === undefined || match[2] === undefined || match[3] === undefined) return null;
	return { major: Number(match[1]), minor: Number(match[2]), patch: Number(match[3]) };
}

/** Negativo si `a < b`, cero si son iguales, positivo si `a > b`, ya analizadas. */
export function compareParts(a: Version, b: Version): number {
	return a.major - b.major || a.minor - b.minor || a.patch - b.patch;
}

/** Negativo si `a < b`, cero si son iguales, positivo si `a > b`. Lanza si alguna no es una versión válida. */
export function compareVersions(a: string, b: string): number {
	const left = parseVersion(a);
	const right = parseVersion(b);
	if (left === null || right === null) throw new RangeError('versión no válida');
	return compareParts(left, right);
}

/**
 * La versión cae en el rango `[min, max]`, con extremos inclusivos; un extremo `null` no acota. Sin versión válida solo
 * cumple un rango sin extremos.
 */
export function inRange(
	version: string | null,
	range: { readonly min: string | null; readonly max: string | null }
): boolean {
	if (version === null || parseVersion(version) === null)
		return range.min === null && range.max === null;
	if (range.min !== null && compareVersions(version, range.min) < 0) return false;
	if (range.max !== null && compareVersions(version, range.max) > 0) return false;
	return true;
}
