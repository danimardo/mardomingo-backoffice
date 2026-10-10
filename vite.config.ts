import { paraglideVitePlugin } from '@inlang/paraglide-js';
import { sveltekit } from '@sveltejs/kit/vite';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vitest/config';

export default defineConfig({
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
		projects: [
			{
				test: {
					name: 'unit',
					environment: 'node',
					include: ['src/**/*.test.ts', 'tests/architecture/**/*.test.ts'],
					exclude: ['src/**/*.int.test.ts', 'src/**/*.component.test.ts']
				}
			},
			{
				test: {
					name: 'component',
					environment: 'jsdom',
					include: ['src/**/*.component.test.ts']
				}
			},
			{
				test: {
					name: 'integration',
					environment: 'node',
					include: ['src/**/*.int.test.ts']
				}
			},
			{
				test: {
					name: 'http',
					environment: 'node',
					include: ['tests/http/**/*.test.ts']
				}
			}
		]
	}
});
