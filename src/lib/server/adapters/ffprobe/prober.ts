// Adaptador de ffprobe (BE-FR-44, D-08; T182). Lee la duración de un audio sin ejecutar nada por shell: `execFile` con
// tiempo máximo, `SIGKILL` si lo excede, señal de cancelación y tope de salida. Si la cabecera no trae la duración (N/A,
// típico de WebM de MediaRecorder), usa el final del último paquete del flujo de audio.
import { execFile } from 'node:child_process';
import { z } from 'zod';

export type ProbeOutcome =
	| { readonly status: 'ok'; readonly durationSeconds: number }
	| { readonly status: 'unreadable' }
	| { readonly status: 'timeout' }
	| { readonly status: 'aborted' };

export interface Prober {
	probe(
		path: string,
		options: { readonly timeoutMs: number; readonly signal: AbortSignal }
	): Promise<ProbeOutcome>;
}

const ProbeJson = z.object({
	format: z.object({ duration: z.string().nullish() }).nullish(),
	packets: z
		.array(z.object({ pts_time: z.string().nullish(), duration_time: z.string().nullish() }))
		.nullish()
});

/** Interpreta la salida JSON de ffprobe. Duración de cabecera; si no hay, el final del último paquete de audio. */
export function durationOf(json: string): ProbeOutcome {
	let parsed: unknown;
	try {
		parsed = JSON.parse(json);
	} catch {
		return { status: 'unreadable' };
	}
	const data = ProbeJson.safeParse(parsed);
	if (!data.success) return { status: 'unreadable' };

	const header = Number(data.data.format?.duration ?? NaN);
	if (Number.isFinite(header) && header > 0) return { status: 'ok', durationSeconds: header };

	const ends = (data.data.packets ?? []).map(
		(packet) => Number(packet.pts_time ?? NaN) + Number(packet.duration_time ?? 0)
	);
	const fromPackets = Math.max(0, ...ends.filter((end) => Number.isFinite(end)));
	return fromPackets > 0
		? { status: 'ok', durationSeconds: fromPackets }
		: { status: 'unreadable' };
}

export interface FfprobeOptions {
	/** Binario, por defecto `ffprobe` del PATH. */
	readonly binary?: string;
	/** Argumentos que van antes de los de la herramienta (las pruebas los usan para lanzar un simulador con node). */
	readonly prefixArgs?: readonly string[];
}

export function createFfprobe(options: FfprobeOptions = {}): Prober {
	const binary = options.binary ?? 'ffprobe';
	const prefix = options.prefixArgs ?? [];
	return {
		probe(path, { timeoutMs, signal }) {
			return new Promise((resolve) => {
				if (signal.aborted) {
					resolve({ status: 'aborted' });
					return;
				}
				const args = [
					...prefix,
					'-v',
					'error',
					'-select_streams',
					'a:0',
					'-show_entries',
					'format=duration:packet=pts_time,duration_time',
					'-of',
					'json',
					path
				];
				execFile(
					binary,
					args,
					{
						timeout: timeoutMs,
						killSignal: 'SIGKILL',
						signal,
						maxBuffer: 8 * 1024 * 1024,
						windowsHide: true
					},
					(error, stdout) => {
						if (signal.aborted) {
							resolve({ status: 'aborted' });
							return;
						}
						if (error) {
							if (error.killed) {
								resolve({ status: 'timeout' });
								return;
							}
							resolve({ status: 'unreadable' });
							return;
						}
						resolve(durationOf(stdout));
					}
				);
			});
		}
	};
}
