import js from '@eslint/js';
import eslintConfigPrettier from 'eslint-config-prettier';
import svelte from 'eslint-plugin-svelte';
import globals from 'globals';
import ts from 'typescript-eslint';

const infraGroups = [
	'$lib/server/db',
	'$lib/server/db/*',
	'$lib/server/adapters',
	'$lib/server/adapters/*',
	'$lib/server/config',
	'$lib/server/config/*',
	'$lib/server/logging',
	'$lib/server/logging/*',
	'$lib/server/forms',
	'$lib/server/forms/*',
	'$lib/server/api',
	'$lib/server/api/*',
	'$lib/server/jobs',
	'$lib/server/jobs/*',
	'$lib/server/composition',
	'$lib/server/features/*'
];

const pureDomainImports = [
	'$app',
	'$app/*',
	'$env',
	'$env/*',
	'@sveltejs/*',
	'drizzle-orm',
	'drizzle-orm/*',
	'better-sqlite3',
	'node:*',
	...infraGroups
];

export default ts.config(
	{
		ignores: [
			'Design/**',
			'src/lib/paraglide/**',
			'build/**',
			'.svelte-kit/**',
			'coverage/**',
			'drizzle/meta/**',
			'playwright-report/**',
			'test-results/**',
			'node_modules/**',
			'.stryker-tmp/**',
			'reports/**'
		]
	},
	js.configs.recommended,
	...ts.configs.strictTypeChecked,
	...svelte.configs.recommended,
	{
		languageOptions: {
			globals: { ...globals.node, ...globals.browser },
			parserOptions: {
				projectService: true,
				extraFileExtensions: ['.svelte'],
				tsconfigRootDir: import.meta.dirname
			}
		}
	},
	{
		files: ['**/*.svelte', '**/*.svelte.ts', '**/*.svelte.js'],
		languageOptions: {
			parserOptions: { parser: ts.parser }
		}
	},
	{
		// Los ficheros JavaScript (configuración y scripts) no pasan por el tipado.
		files: ['**/*.js', '**/*.mjs', '**/*.cjs'],
		...ts.configs.disableTypeChecked
	},
	{
		rules: {
			'@typescript-eslint/consistent-type-assertions': ['error', { assertionStyle: 'never' }],
			'no-console': 'error',
			'svelte/no-navigation-without-resolve': 'error',
			'svelte/require-each-key': 'error',
			'svelte/no-at-html-tags': 'error',
			'no-restricted-globals': [
				'error',
				{ name: 'fetch', message: 'Usa un servicio o un adaptador, no fetch directo.' }
			],
			'no-restricted-imports': [
				'error',
				{
					paths: [
						{
							name: '$app/stores',
							message: 'Usa $app/state (constitución, «Estado y componentes»).'
						},
						{ name: 'svelte/store', message: 'Usa runes ($state, $derived) en código nuevo.' }
					],
					patterns: [
						{
							group: ['pino', 'pino-*'],
							message: 'Solo $lib/server/logging importa pino (principio XI).'
						},
						{
							group: ['loglevel'],
							message: 'Solo $lib/logging/client.ts importa loglevel (principio XI).'
						},
						{
							group: ['$env', '$env/*'],
							message:
								'Solo $lib/server/config/env.ts lee el entorno (constitución, «Configuración»).'
						}
					]
				}
			],
			'no-restricted-syntax': [
				'error',
				{
					selector: 'MemberExpression[object.name="process"][property.name="env"]',
					message: 'Solo $lib/server/config/env.ts lee el entorno.'
				},
				{
					selector: "CallExpression[callee.name='redirect'] Literal[value=/^\\//]",
					message:
						'redirect() con una ruta literal: usa resolve() de $app/paths (svelte/no-navigation-without-resolve no cubre redirect).'
				}
			]
		}
	},
	{
		// Los módulos de logging, la configuración del entorno y las herramientas
		// de consola pueden usar sus propias primitivas. Los ficheros de configuración de
		// herramientas (drizzle, vite, Playwright) leen el entorno del proceso que las ejecuta.
		files: [
			'src/lib/server/logging/**',
			'src/lib/logging/client.ts',
			'scripts/**',
			'drizzle.config.ts',
			'vite.config.ts',
			'playwright.config.ts'
		],
		rules: {
			'no-console': 'off',
			'no-restricted-imports': 'off',
			'no-restricted-syntax': 'off'
		}
	},
	{
		files: ['src/lib/server/config/env.ts'],
		rules: { 'no-restricted-imports': 'off', 'no-restricted-syntax': 'off' }
	},
	{
		// Acceso a la base de datos y a los adaptadores solo desde infraestructura y servicios.
		files: ['src/routes/**'],
		rules: {
			'no-restricted-imports': [
				'error',
				{
					patterns: [
						{
							group: [
								'$lib/server/db',
								'$lib/server/db/*',
								'$lib/server/adapters',
								'$lib/server/adapters/*'
							],
							message:
								'Las rutas no importan la BD ni los adaptadores; usa el index.ts de la funcionalidad.'
						},
						{
							group: ['$lib/server/features/*/domain', '$lib/server/features/*/domain/*'],
							message: 'Las rutas no importan el dominio; usa el index.ts de la funcionalidad.'
						}
					]
				}
			]
		}
	},
	{
		files: ['src/lib/components/**'],
		rules: {
			'no-restricted-globals': [
				'error',
				{ name: 'fetch', message: 'Los componentes no llaman a fetch.' }
			],
			'no-restricted-imports': [
				'error',
				{
					patterns: [
						{
							group: ['$lib/server', '$lib/server/*'],
							message: 'Los componentes no importan código de servidor.'
						}
					]
				}
			]
		}
	},
	{
		// Los adaptadores son la frontera de E/S HTTP del servidor (Turnstile): ahí sí puede haber `fetch`. El resto
		// del código sigue sin usarlo (la regla de arriba dice «usa un servicio o un adaptador»).
		files: ['src/lib/server/adapters/**/*.ts'],
		rules: { 'no-restricted-globals': 'off' }
	},
	{
		// Dominio puro: sin I/O, sin entorno, sin reloj real y sin otras funcionalidades.
		files: ['src/lib/server/features/*/domain/**', 'src/lib/shared/**', 'src/lib/server/shared/**'],
		rules: {
			'no-restricted-globals': ['error', { name: 'fetch', message: 'El dominio no hace I/O.' }],
			'no-restricted-imports': [
				'error',
				{
					patterns: [
						{
							group: pureDomainImports,
							message:
								'El dominio es puro: sin I/O, sin entorno y sin otras funcionalidades (principio IV).'
						}
					]
				}
			],
			'no-restricted-syntax': [
				'error',
				{
					selector: 'CallExpression[callee.object.name="Date"][callee.property.name="now"]',
					message: 'El dominio recibe el tiempo como parámetro (Clock).'
				},
				{
					selector: 'NewExpression[callee.name="Date"]',
					message: 'El dominio recibe el tiempo como parámetro (EpochMs).'
				},
				{
					selector: 'MemberExpression[object.name="process"]',
					message: 'El dominio no lee el proceso ni el entorno.'
				}
			]
		}
	},
	{
		// Los tipos de dinero y fecha son la única excepción a la prohibición de aserciones.
		files: ['src/lib/shared/**'],
		rules: {
			'@typescript-eslint/consistent-type-assertions': 'off'
		}
	},
	eslintConfigPrettier
);
