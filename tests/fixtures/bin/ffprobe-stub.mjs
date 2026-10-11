// Simulador de ffprobe para las pruebas de adaptador (T182). Responde según el nombre del último argumento (la ruta):
// `sleep` se cuelga (prueba el tiempo máximo), `corrupt` falla (ilegible), `packets` no trae duración en la cabecera.
const path = process.argv.at(-1) ?? '';
if (path.endsWith('sleep.webm')) {
	setTimeout(() => undefined, 60_000);
} else if (path.endsWith('corrupt.webm')) {
	process.stderr.write('Invalid data found when processing input\n');
	process.exit(1);
} else if (path.endsWith('packets.webm')) {
	const packets = [
		{ pts_time: '0.000', duration_time: '1.000' },
		{ pts_time: '1.000', duration_time: '2.500' }
	];
	process.stdout.write(`${JSON.stringify({ format: { duration: 'N/A' }, packets })}\n`);
} else {
	process.stdout.write(`${JSON.stringify({ format: { duration: '3.500000' } })}\n`);
}
