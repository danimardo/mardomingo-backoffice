// Serializador CSV común de la aplicación (BE-FR-49.6, BE-FR-76; T239). Lo reutilizan la exportación contable (T240) y las
// exportaciones del panel (T252). Formato para hoja de cálculo en español: separador `;`, coma decimal, BOM UTF-8 opcional y
// neutralización de fórmulas en el texto (un campo que empieza por `=`, `+`, `-` o `@` se escribe con una comilla delante).

export type CsvCell = string | number | boolean | null | undefined;

const FORMULA_START = /^[=+\-@]/;
const NEEDS_QUOTES = /[;"\r\n]/;

/** Escribe una celda: texto neutralizado y entrecomillado si hace falta; números con coma decimal. */
export function csvCell(value: CsvCell): string {
	if (value === null || value === undefined) return '';
	if (typeof value === 'boolean') return value ? 'sí' : 'no';
	if (typeof value === 'number') {
		if (!Number.isFinite(value)) throw new RangeError('una celda numérica debe ser finita');
		return String(value).replace('.', ',');
	}
	const neutral = FORMULA_START.test(value) ? `'${value}` : value;
	return NEEDS_QUOTES.test(neutral) ? `"${neutral.replace(/"/g, '""')}"` : neutral;
}

/** Documento CSV completo con cabecera opcional, fin de línea CRLF y BOM UTF-8 si se pide (hojas de cálculo). */
export function toCsv(
	rows: readonly (readonly CsvCell[])[],
	options: { readonly header?: readonly string[]; readonly bom?: boolean } = {}
): string {
	const lines = [...(options.header === undefined ? [] : [options.header]), ...rows].map(
		(line) => line.map(csvCell).join(';') + '\r\n'
	);
	const body = lines.join('');
	return options.bom === true ? `\uFEFF${body}` : body;
}
