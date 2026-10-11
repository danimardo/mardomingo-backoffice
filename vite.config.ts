import { paraglideVitePlugin } from '@inlang/paraglide-js';
import { sveltekit } from '@sveltejs/kit/vite';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vitest/config';

export default defineConfig({
	// Con Vitest, Svelte resuelve su build de navegador para montar componentes (pruebas de componente).
	...(process.env.VITEST ? { resolve: { conditions: ['browser'] } } : {}),
	plugins: [
		tailwindcss(),
		sveltekit(),
		paraglideVitePlugin({
			project: './project.inlang',
			outdir: './src/lib/paraglide',
			strategy: ['baseLocale']
		})
	],
	build: {
		// Los mapas de código se generan ocultos: no se sirven al navegador, pero
		// permiten traducir las líneas de /client-errors (constitución, principio XI).
		sourcemap: 'hidden'
	},
	test: {
		testTimeout: 30_000,
		coverage: {
			provider: 'v8',
			include: ['src/lib/**'],
			exclude: ['src/lib/paraglide/**'],
			thresholds: {
				lines: 80,
				functions: 80,
				branches: 80,
				statements: 80,
				// Dominio, dinero y fechas, y los identificadores y errores compartidos: 100 % (T-TEST-002).
				'src/lib/server/features/*/domain/**': {
					lines: 100,
					functions: 100,
					branches: 100,
					statements: 100
				},
				'src/lib/shared/**': { lines: 100, functions: 100, branches: 100, statements: 100 },
				'src/lib/server/shared/**': {
					lines: 100,
					functions: 100,
					branches: 100,
					statements: 100
				}
			}
		},
		projects: [
			{
				test: {
					name: 'unit',
					environment: 'node',
					include: ['src/**/*.test.ts', 'tests/architecture/**/*.test.ts'],
					exclude: ['src/**/*.int.test.ts', 'src/**/*.component.test.ts'],
					setupFiles: ['tests/setup/unit.setup.ts'],
					// Los emails toman los colores de tokens.css con `?raw`; sin esto Vitest devuelve el CSS vacío.
					css: { include: [/tokens\.css(\?raw)?$/] }
				}
			},
			{
				test: {
					name: 'component',
					environment: 'jsdom',
					include: ['src/**/*.component.test.ts'],
					setupFiles: ['tests/setup/component.setup.ts']
				}
			},
			{
				test: {
					name: 'integration',
					environment: 'node',
					include: ['src/**/*.int.test.ts'],
					globalSetup: ['tests/setup/integration.global-setup.ts'],
					// Igual que en unit: los emails de cuentas leen tokens.css con `?raw` al cargar el servicio.
					css: { include: [/tokens\.css(\?raw)?$/] }
				}
			},
			{
				test: {
					name: 'http',
					environment: 'node',
					include: ['tests/http/**/*.test.ts'],
					globalSetup: ['tests/setup/http.global-setup.ts']
				}
			}
		]
	}
});
