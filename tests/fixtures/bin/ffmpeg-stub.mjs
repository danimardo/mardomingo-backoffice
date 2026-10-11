// Simulador de ffmpeg para las pruebas de adaptador (T182): copia la entrada a la salida (la última ruta). `corrupt`
// falla, y `sleep` se cuelga para probar el tiempo máximo.
import { copyFileSync } from 'node:fs';
const args = process.argv.slice(2);
const input = args[args.indexOf('-i') + 1] ?? '';
const output = args.at(-1) ?? '';
if (input.endsWith('sleep.webm')) {
	setTimeout(() => undefined, 60_000);
} else if (input.endsWith('corrupt.webm')) {
	process.stderr.write('Invalid data found when processing input\n');
	process.exit(1);
} else {
	copyFileSync(input, output);
}
