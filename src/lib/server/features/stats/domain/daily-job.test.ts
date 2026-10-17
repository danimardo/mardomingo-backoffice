// Reglas de la tarea diaria (L14; T317 ampliado): precio de referencia con mediana, mínimo de muestras y valor manual que manda;
// diferencia de descargas; y suma de descargas de los releases.
import { describe, expect, it } from 'vitest';
import { downloadsSinceYesterday, priceReference, totalReleaseDownloads } from './daily-job';

describe('precio de referencia', () => {
	it('con muestras suficientes, la mediana de los costes', () => {
		expect(
			priceReference({ costsMicroUsd: [100, 300, 200], minSamples: 3, manualMicro: null })
		).toEqual({
			typicalMicro: 200,
			source: 'auto',
			sampleSize: 3
		});
	});

	it('con un número par de muestras, la media de las dos centrales', () => {
		expect(
			priceReference({ costsMicroUsd: [100, 200, 300, 400], minSamples: 2, manualMicro: null })
				?.typicalMicro
		).toBe(250);
	});

	it('con pocas muestras no hay precio automático: null, no un precio inventado', () => {
		expect(
			priceReference({ costsMicroUsd: [100, 200], minSamples: 3, manualMicro: null })
		).toBeNull();
	});

	it('un valor manual manda sobre el cálculo, incluso sin muestras', () => {
		expect(priceReference({ costsMicroUsd: [], minSamples: 3, manualMicro: 500 })).toEqual({
			typicalMicro: 500,
			source: 'manual',
			sampleSize: 0
		});
	});

	it('un valor atípico no mueve la mediana como movería la media', () => {
		expect(
			priceReference({
				costsMicroUsd: [100, 110, 120, 1_000_000],
				minSamples: 3,
				manualMicro: null
			})?.typicalMicro
		).toBe(115);
	});
});

describe('descargas del día', () => {
	it('es la diferencia con el acumulado del día anterior', () => {
		expect(downloadsSinceYesterday(150, 120)).toBe(30);
	});

	it('la primera lectura no tiene diferencia: null, no cero', () => {
		expect(downloadsSinceYesterday(150, null)).toBeNull();
	});

	it('si el acumulado baja (un release borrado), la diferencia no es negativa', () => {
		expect(downloadsSinceYesterday(90, 120)).toBe(0);
	});
});

describe('total de descargas de los releases', () => {
	it('suma los activos de todos los releases', () => {
		expect(
			totalReleaseDownloads([
				{ assets: [{ download_count: 10 }, { download_count: 5 }] },
				{ assets: [{ download_count: 7 }] }
			])
		).toBe(22);
	});

	it('sin releases, el total es cero', () => {
		expect(totalReleaseDownloads([])).toBe(0);
	});
});
