// Adaptador real del BCE (BE-FR-87; R13; T149). `GET …/service/data/EXR/D.USD.EUR.SP00.A?format=csvdata&detail=dataonly&
// lastNObservations=1`. La cabecera del CSV se valida exacta; una fila que no encaja es `invalid`, no un valor. Un 200 sin
// cuerpo es `empty`. Red, tiempo agotado y 5xx son `unavailable`; otros códigos HTTP, `http`.
import * as z from 'zod';
import type { EcbFetch, FxSource } from './fx-source';

const HEADER: readonly string[] = Object.freeze([
	'KEY',
	'FREQ',
	'CURRENCY',
	'CURRENCY_DENOM',
	'EXR_TYPE',
	'EXR_SUFFIX',
	'TIME_PERIOD',
	'OBS_VALUE'
]);
const DEFAULT_TIMEOUT_MS = 5_000;

const ROW = z.object({
	CURRENCY: z.literal('USD'),
	CURRENCY_DENOM: z.literal('EUR'),
	TIME_PERIOD: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
	OBS_VALUE: z.string().regex(/^\d+(\.\d{1,6})?$/)
});

export interface EcbOptions {
	/** `https://data-api.ecb.europa.eu` en producción; el simulador en pruebas. */
	readonly endpoint: string;
	readonly timeoutMs?: number;
}

/** Interpreta el CSV de una observación. Exportado para probarlo sin red. */
export function parseEcbCsv(text: string): EcbFetch {
	const lines = text.split(/\r?\n/).filter((line) => line.trim() !== '');
	if (lines.length === 0) return { status: 'empty' };
	if (lines.length !== 2 || lines[0] !== HEADER.join(','))
		return { status: 'error', reason: 'invalid' };
	const fields = (lines[1] ?? '').split(',');
	if (fields.length !== HEADER.length) return { status: 'error', reason: 'invalid' };
	const record = Object.fromEntries(HEADER.map((name, index) => [name, fields[index] ?? '']));
	const row = ROW.safeParse(record);
	if (!row.success) return { status: 'error', reason: 'invalid' };
	return { status: 'observation', timePeriod: row.data.TIME_PERIOD, rate: row.data.OBS_VALUE };
}

export function createEcbFxSource(options: EcbOptions): FxSource {
	const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
	return {
		async fetchLatest(): Promise<EcbFetch> {
			try {
				const url = `${options.endpoint}/service/data/EXR/D.USD.EUR.SP00.A?format=csvdata&detail=dataonly&lastNObservations=1`;
				const response = await fetch(url, {
					headers: { accept: 'text/csv' },
					signal: AbortSignal.timeout(timeoutMs)
				});
				if (response.status >= 500) return { status: 'error', reason: 'unavailable' };
				if (!response.ok) return { status: 'error', reason: 'http' };
				return parseEcbCsv(await response.text());
			} catch {
				return { status: 'error', reason: 'unavailable' };
			}
		}
	};
}
