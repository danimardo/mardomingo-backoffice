// Marcador de privacidad (T173; Historias 15.10, V13): un texto único por prueba que el contenido del usuario contiene a
// propósito. Después la prueba busca el marcador en la base de datos, en la salida del logger y en el directorio
// temporal: no debe aparecer en ninguna de las tres (BE-FR-86/87 y la regla de no guardar contenido en los logs).
import { randomUUID } from 'node:crypto';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import type { TestDatabase } from '../builders/database';
import type { FakeLogger } from '../builders/fake-logger';

/** Texto único para esta prueba. Nunca se reutiliza entre pruebas. */
export function privacyMarker(): string {
	return `MARCADOR_PRIVACIDAD_${randomUUID().replaceAll('-', '')}`;
}

/** Busca el marcador en todas las tablas de la base de datos, incluidas las filas de auditoría. */
export function markerInDatabase(database: TestDatabase, marker: string): boolean {
	const tables = database.sqlite
		.prepare(
			"SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '__drizzle%'"
		)
		.pluck()
		.all()
		.map(String);
	return tables.some((name) => {
		const rows = database.sqlite.prepare(`SELECT * FROM "${name}"`).all();
		return JSON.stringify(rows).includes(marker);
	});
}

/** Busca el marcador en todos los eventos que registró el logger de la prueba. */
export function markerInLogs(logger: FakeLogger, marker: string): boolean {
	return JSON.stringify(logger.events).includes(marker);
}

/** Busca el marcador en todos los ficheros de un directorio, recursivamente (ficheros temporales incluidos). */
export function markerInDirectory(directory: string, marker: string): boolean {
	return readdirSync(directory).some((entry) => {
		const path = join(directory, entry);
		if (statSync(path).isDirectory()) return markerInDirectory(path, marker);
		return readFileSync(path).includes(marker);
	});
}
