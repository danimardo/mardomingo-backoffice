// Adaptador de ffmpeg (BE-FR-44, D-08; T182). Convierte el audio a mp3 o wav en el mismo directorio temporal, para los
// proveedores que no aceptan WebM. Sin shell, con tiempo máximo, `SIGKILL` y señal de cancelación.
import { execFile } from 'node:child_process';

export type TargetFormat = 'mp3' | 'wav';

export type ConvertOutcome =
	| { readonly status: 'ok'; readonly outputPath: string }
	| { readonly status: 'failed' }
	| { readonly status: 'timeout' }
	| { readonly status: 'aborted' };

export interface Converter {
	convert(
		inputPath: string,
		outputPath: string,
		options: {
			readonly format: TargetFormat;
			readonly timeoutMs: number;
			readonly signal: AbortSignal;
		}
	): Promise<ConvertOutcome>;
}

export interface FfmpegOptions {
	/** Binario, por defecto `ffmpeg` del PATH. */
	readonly binary?: string;
	/** Argumentos que van antes de los de la herramienta (las pruebas los usan para lanzar un simulador con node). */
	readonly prefixArgs?: readonly string[];
}

export function createFfmpeg(options: FfmpegOptions = {}): Converter {
	const binary = options.binary ?? 'ffmpeg';
	const prefix = options.prefixArgs ?? [];
	return {
		convert(inputPath, outputPath, { format, timeoutMs, signal }) {
			return new Promise((resolve) => {
				if (signal.aborted) {
					resolve({ status: 'aborted' });
					return;
				}
				const codec = format === 'mp3' ? ['-codec:a', 'libmp3lame'] : ['-codec:a', 'pcm_s16le'];
				const args = [
					...prefix,
					'-v',
					'error',
					'-y',
					'-i',
					inputPath,
					'-vn',
					'-ac',
					'1',
					'-ar',
					'16000',
					...codec,
					outputPath
				];
				execFile(
					binary,
					args,
					{
						timeout: timeoutMs,
						killSignal: 'SIGKILL',
						signal,
						maxBuffer: 1024 * 1024,
						windowsHide: true
					},
					(error) => {
						if (signal.aborted) {
							resolve({ status: 'aborted' });
							return;
						}
						if (error) {
							resolve(error.killed ? { status: 'timeout' } : { status: 'failed' });
							return;
						}
						resolve({ status: 'ok', outputPath });
					}
				);
			});
		}
	};
}
