// Columnas de dominio para SQLite (R03; data-model.md 1.1). Cada columna convierte su tipo de dominio al leer
// (`fromDriver`) y valida lo que llega de la base de datos, en selecciones completas y parciales. Las restricciones
// `CHECK` van en la tabla (`check()` de drizzle), así que este módulo también da el fragmento SQL de cada una.
import { customType, integer, text } from 'drizzle-orm/sqlite-core';
import { sql, type SQL } from 'drizzle-orm';
import { toCivilDate, toEpochMs, type CivilDate, type EpochMs } from '$lib/shared/time';
import {
	toEurCents,
	toMicro,
	toMicroUsd,
	toPpm,
	type EurCents,
	type Micro,
	type MicroUsd,
	type Ppm
} from '$lib/shared/money';

/** Micro-créditos (µc): entero, nunca decimal. */
export const micro = customType<{ data: Micro; driverData: number }>({
	dataType: () => 'integer',
	fromDriver: (value) => toMicro(value),
	toDriver: (value) => value
});

/** Millonésimas (ppm): entero no negativo. */
export const ppm = customType<{ data: Ppm; driverData: number }>({
	dataType: () => 'integer',
	fromDriver: (value) => toPpm(value),
	toDriver: (value) => value
});

/** Micro-dólares (µUSD): entero no negativo. */
export const microUsd = customType<{ data: MicroUsd; driverData: number }>({
	dataType: () => 'integer',
	fromDriver: (value) => toMicroUsd(value),
	toDriver: (value) => value
});

/** Céntimos de euro: entero. */
export const eurCents = customType<{ data: EurCents; driverData: number }>({
	dataType: () => 'integer',
	fromDriver: (value) => toEurCents(value),
	toDriver: (value) => value
});

/** Instante en milisegundos UTC: entero. */
export const epochMs = customType<{ data: EpochMs; driverData: number }>({
	dataType: () => 'integer',
	fromDriver: (value) => toEpochMs(value),
	toDriver: (value) => value
});

/** Día civil de Madrid `YYYY-MM-DD`: texto. */
export const civilDate = customType<{ data: CivilDate; driverData: string }>({
	dataType: () => 'text',
	fromDriver: (value) => toCivilDate(value),
	toDriver: (value) => value
});

/** Valor por defecto `now` de las columnas de instante: milisegundos UTC del momento de la inserción. */
export const nowMs = sql`(CAST(unixepoch('subsec') * 1000 AS INTEGER))`;

/** Booleano como entero 0/1 (la restricción `IN (0,1)` va en la tabla con `boolCheck`). */
export const bool = (name: string) => integer(name, { mode: 'boolean' });

/** JSON validado en lectura: la restricción `json_valid` va en la tabla con `jsonCheck`. */
export const json = <T>(name: string) => text(name, { mode: 'json' }).$type<T>();

/** Fragmento `CHECK` de un booleano: solo 0 o 1. */
export const boolCheck = (column: string) => sql`${sql.identifier(column)} IN (0, 1)`;

/** Fragmento `CHECK` de un día civil: forma `YYYY-MM-DD`. */
export const civilDateCheck = (column: string) =>
	sql`${sql.identifier(column)} GLOB '[0-9][0-9][0-9][0-9]-[0-1][0-9]-[0-3][0-9]'`;

/** Fragmento `CHECK` de un JSON: debe ser JSON válido. */
export const jsonCheck = (column: string) => sql`json_valid(${sql.identifier(column)})`;

/** Fragmento `CHECK` de un entero no negativo. */
export const nonNegativeCheck = (column: string) => sql`${sql.identifier(column)} >= 0`;

/**
 * Fragmento `CHECK` de un enumerado: el DDL no admite parámetros, así que los valores van como literales.
 * Solo se aceptan valores en minúsculas con `_`, que son los que define el código.
 */
export function enumCheck(column: string, values: readonly string[]): SQL {
	const literals = values.map((value) => {
		if (!/^[a-z_]+$/.test(value)) throw new Error(`Valor de enumerado no válido: ${value}`);
		return sql.raw(`'${value}'`);
	});
	return sql`${sql.identifier(column)} IN (${sql.join(literals, sql`, `)})`;
}
