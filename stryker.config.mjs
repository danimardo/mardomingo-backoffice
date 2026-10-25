// Mutation testing (Historias.md 15.20). Piloto tras cerrar L05 y L06; ejecución
// programada, nunca en el bucle de desarrollo. Sin umbral de partida: primero se
// fija una línea base y después el umbral que bloquea la release.
/** @type {import('@stryker-mutator/api/core').PartialStrykerOptions} */
const config = {
	// Stryker y su runner viven en tools/mutacion (Vitest 4.x, T368): el proyecto usa Vitest 5 y el runner
	// de Stryker 10 no lo soporta. Ruta relativa al cwd (la raíz del proyecto).
	plugins: ['./tools/mutacion/node_modules/@stryker-mutator/vitest-runner/dist/src/index.js'],
	testRunner: 'vitest',
	vitest: { configFile: 'vite.config.ts', related: true },
	mutate: [
		'src/lib/server/features/*/domain/**/*.ts',
		'src/lib/shared/**/*.ts',
		'src/lib/server/shared/**/*.ts',
		'!src/**/*.test.ts',
		'!src/**/*.component.test.ts'
	],
	// Con `perTest` el runner de Vitest (proyectos) no recoge la cobertura por prueba y marca los mutantes como vivos sin ejecutarlos.
	coverageAnalysis: 'all',
	incremental: true,
	incrementalFile: 'reports/stryker-incremental.json',
	tempDirName: '.stryker-tmp',
	// En Windows, Vitest bloquea ficheros de caché y la limpieza de sandboxes falla con EPERM: no se borra al terminar.
	cleanTempDir: false,
	reporters: ['clear-text', 'progress', 'html'],
	htmlReporter: { fileName: 'reports/mutation/index.html' },
	// Umbrales de referencia para el informe; no bloquean hasta fijar la línea base.
	// Umbral de partida decidido por el propietario (2026-10-22): por debajo del 60 % la ejecución falla.
	thresholds: { high: 80, low: 60, break: 60 },
	ignoreStatic: false,
	timeoutMS: 30000
};

export default config;
