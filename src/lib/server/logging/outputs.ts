// Destinos de los logs (constitución, principio XI; contracts/log-events.md; T026 en su parte de la v4).
// Todos los entornos escriben JSON en stdout (Docker lo conserva con rotación). En desarrollo, además,
// stdout pasa a pino-pretty con hora de Madrid y el JSON se guarda en `.logs/app.log`, vaciado en cada
// arranque. El envío al Log Gateway queda para una fase posterior (enmienda 2.2.0).
import { createWriteStream, mkdirSync } from 'node:fs';
import { join } from 'node:path';

/** Destino mínimo de pino. `process.stdout` ya cumple esta forma. */
export interface LogSink {
	write(chunk: string): void;
}

export interface LogSinkOptions {
	readonly development: boolean;
	readonly logDir: string;
}

export async function createLogSink(options: LogSinkOptions): Promise<LogSink> {
	if (!options.development) return process.stdout;

	// Carga perezosa: pino-pretty es dependencia de desarrollo y no se necesita en producción.
	const { default: createPretty } = await import('pino-pretty');
	mkdirSync(options.logDir, { recursive: true });
	const file = createWriteStream(join(options.logDir, 'app.log'), { flags: 'w' });
	const pretty = createPretty({
		sync: true,
		ignore: 'pid,hostname,schema,service,env,version',
		translateTime: false,
		customPrettifiers: {
			time: (value) => formatInMadrid(value)
		}
	});

	return {
		write(chunk) {
			pretty.write(chunk);
			file.write(chunk);
		}
	};
}

const madridFormat = new Intl.DateTimeFormat('es-ES', {
	timeZone: 'Europe/Madrid',
	year: 'numeric',
	month: '2-digit',
	day: '2-digit',
	hour: '2-digit',
	minute: '2-digit',
	second: '2-digit',
	hour12: false
});

/** Hora de Madrid para la salida de desarrollo. Los datos del registro siguen en UTC. */
export function formatInMadrid(value: unknown): string {
	if (typeof value !== 'string') return String(value);
	const instant = new Date(value);
	if (Number.isNaN(instant.getTime())) return value;
	return madridFormat.format(instant);
}
