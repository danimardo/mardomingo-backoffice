// Simulador de OpenRouter para la prueba de carga contra la imagen (T370). Escucha en el puerto indicado y sigue en marcha
// hasta SIGINT. Uso: node scripts/perf-mock-openrouter.mjs [puerto=4010]
import { register } from 'node:module';

register('./perf-ts-resolver.mjs', import.meta.url);
const { startOpenRouterMock } = await import('../tests/mock-servers/openrouter.ts');

const port = Number(process.argv[2] ?? 4010);
const mock = await startOpenRouterMock(port);
console.log(JSON.stringify({ mock: 'openrouter', url: mock.url }));
const stop = async () => {
	await mock.close();
	process.exit(0);
};
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
