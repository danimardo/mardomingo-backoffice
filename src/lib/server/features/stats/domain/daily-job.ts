// Reglas puras de la tarea diaria (L14; BE-FR-73, BE-FR-54). Sin base de datos, sin reloj y sin red: quien la llama le pasa los datos.

/** Precio orientativo a partir de las muestras de coste de una operación (micro-USD). Mediana: resiste los valores atípicos. */
export interface PriceReference {
	readonly typicalMicro: number;
	readonly source: 'auto' | 'manual';
	readonly sampleSize: number;
}

function median(values: readonly number[]): number {
	const sorted = [...values].sort((left, right) => left - right);
	const middle = Math.floor(sorted.length / 2);
	if (sorted.length % 2 === 1) return sorted[middle] ?? 0;
	return Math.round(((sorted[middle - 1] ?? 0) + (sorted[middle] ?? 0)) / 2);
}

/**
 * Precio de referencia de una operación. Con pocas muestras no hay precio automático (null), porque un precio con dos casos es ruido.
 * Si el administrador fijó un valor manual, ese es el efectivo y sobrevive a los recálculos.
 */
export function priceReference(input: {
	readonly costsMicroUsd: readonly number[];
	readonly minSamples: number;
	readonly manualMicro: number | null;
}): PriceReference | null {
	if (input.manualMicro !== null) {
		return {
			typicalMicro: input.manualMicro,
			source: 'manual',
			sampleSize: input.costsMicroUsd.length
		};
	}
	if (input.costsMicroUsd.length < input.minSamples) return null;
	return {
		typicalMicro: median(input.costsMicroUsd),
		source: 'auto',
		sampleSize: input.costsMicroUsd.length
	};
}

/** Descargas del día a partir del acumulado: la diferencia con el día anterior. Sin día anterior, la primera lectura no tiene diferencia. */
export function downloadsSinceYesterday(
	cumulative: number,
	previousCumulative: number | null
): number | null {
	if (previousCumulative === null) return null;
	return Math.max(0, cumulative - previousCumulative);
}

/** Suma de descargas de todos los activos de los releases de un repositorio (la API de GitHub entrega `download_count` por activo). */
export function totalReleaseDownloads(
	releases: readonly { readonly assets: readonly { readonly download_count: number }[] }[]
): number {
	return releases.reduce(
		(sum, release) =>
			sum + release.assets.reduce((assetSum, asset) => assetSum + asset.download_count, 0),
		0
	);
}
