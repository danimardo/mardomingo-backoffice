// Tamaño del cuerpo de las peticiones (`BODY_SIZE_LIMIT` de SvelteKit): `10M`, `512K`, `1G` o bytes (T185; FR-070). Puro.
const UNITS: Readonly<Record<string, number>> = Object.freeze({
	K: 1024,
	M: 1024 ** 2,
	G: 1024 ** 3
});

/** Bytes que admite un valor de `BODY_SIZE_LIMIT`; `NaN` si no es un tamaño válido. */
export function bodyLimitBytes(value: string): number {
	const match = /^(\d+)([KMG]?)$/i.exec(value.trim());
	if (match?.[1] === undefined) return Number.NaN;
	const unit = match[2]?.toUpperCase() ?? '';
	return Number(match[1]) * (unit === '' ? 1 : (UNITS[unit] ?? 1));
}
