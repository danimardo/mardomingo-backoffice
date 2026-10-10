// Mutation testing (Historias.md 15.20). Piloto tras cerrar L05 y L06; ejecución
// programada, nunca en el bucle de desarrollo. Sin umbral de partida: primero se
// fija una línea base y después el umbral que bloquea la release.
/** @type {import('@stryker-mutator/api/core').PartialStrykerOptions} */
const config = {
	testRunner: 'vitest',
	vitest: { configFile: 'vite.config.ts', related: false },
	mutate: [
		'src/lib/server/features/*/domain/**/*.ts',
		'src/lib/shared/**/*.ts',
		'src/lib/server/shared/**/*.ts',
		'!src/**/*.test.ts',
		'!src/**/*.component.test.ts'
	],
	incremental: true,
	incrementalFile: 'reports/stryker-incremental.json',
	tempDirName: '.stryker-tmp',
	reporters: ['clear-text', 'progress', 'html'],
	htmlReporter: { fileName: 'reports/mutation/index.html' },
	// Umbrales de referencia para el informe; no bloquean hasta fijar la línea base.
	thresholds: { high: 80, low: 60, break: null },
	ignoreStatic: true,
	timeoutMS: 30000
};

export default config;
