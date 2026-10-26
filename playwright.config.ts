// Configuración de Playwright (T-PLAY-001; R09, R16). Arranca la aplicación construida con un entorno explícito:
// sin `.env` ni sintaxis de shell, base de datos temporal y secretos aleatorios generados al cargar esta
// configuración. La web y la API se sirven desde el mismo proceso, en hosts distintos (localhost y 127.0.0.1),
// para que la separación por host se ejerza igual que en producción.
import { execFileSync } from 'node:child_process';
import { randomBytes, randomUUID } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { defineConfig, devices } from '@playwright/test';
import { TURNSTILE_MOCK_URL } from './e2e/constants';

const PORT = 7390;
const WEB_ORIGIN = `http://localhost:${String(PORT)}`;
const API_ORIGIN = `http://127.0.0.1:${String(PORT)}`;
const E2E_DIR = join('test-results', 'e2e');
mkdirSync(E2E_DIR, { recursive: true });
// Ruta de la base del servidor E2E. La ejecución principal la crea y la escribe en un fichero; los workers la leen de ahí, así
// los specs que necesitan la base (p. ej. promover a administrador) la conocen sin leer el entorno.
const E2E_DB_FILE = join(E2E_DIR, 'db-path.txt');
if (process.env.TEST_WORKER_INDEX === undefined) {
	writeFileSync(E2E_DB_FILE, join(E2E_DIR, `app-${randomUUID()}.db`));
}
const e2eDbPath = readFileSync(E2E_DB_FILE, 'utf8');
// Siembra de la cuenta del panel (T250) con los servicios, antes de arrancar el servidor: la hace Vitest en su proyecto
// `e2e-seed`. Contra un despliegue (`E2E_BASE_URL`) no se siembra: no hay base local que preparar.
if (process.env.TEST_WORKER_INDEX === undefined && process.env.E2E_BASE_URL === undefined) {
	writeFileSync(join(E2E_DIR, 'seed-pending.txt'), e2eDbPath);
	execFileSync('pnpm', ['exec', 'vitest', 'run', '--project', 'e2e-seed'], {
		stdio: 'inherit',
		shell: true
	});
}

const nightly = process.env.E2E_NIGHTLY === '1';

/** Spec de administración con un único administrador por base: solo en chromium (T314). */
const ADMIN_SPEC = /admin-contenido\.spec\.ts/;

/** Publica una versión legal con reaceptación para todas las cuentas: corre el último, en su proyecto (T288). */
const LEGAL_LAST_SPEC = /legal-critico7\.spec\.ts/;

/** Mantenimiento, copia de predeterminados, cierre de sesiones y reembolso: corre el último, en su proyecto (T322). */
const ADMIN_FINAL_SPEC = /admin-cierre\.spec\.ts/;

/**
 * Matriz completa de UX (T357): solo en la nocturna. Va en el `testIgnore` de cada proyecto, porque el de un proyecto
 * sustituye al global: un `testIgnore` solo en la raíz no la excluiría.
 */
const NIGHTLY_ONLY = nightly ? [] : [/ux-matrix-nocturna\.spec\.ts/];

export default defineConfig({
	testDir: 'e2e',
	globalSetup: './e2e/global-setup.ts',
	outputDir: join(E2E_DIR, 'artifacts'),
	fullyParallel: true,
	// Dos workers: con más, la red local satura las peticiones de `__data.json` y aparecen fallos de contención (ERR_ABORTED,
	// ERR_NO_BUFFER_SPACE) que no son regresiones. Se mide el tiempo total en la validación; no se rebaja ningún umbral.
	workers: 2,
	forbidOnly: Boolean(process.env.CI),
	retries: process.env.CI ? 1 : 0,
	reporter: [['list'], ['html', { open: 'never', outputFolder: join(E2E_DIR, 'report') }]],
	use: {
		// E2E_BASE_URL apunta el smoke a un despliegue real (T374); sin ella, el servidor local de la suite.
		baseURL: process.env.E2E_BASE_URL ?? WEB_ORIGIN,
		trace: 'retain-on-failure',
		screenshot: 'only-on-failure',
		video: nightly ? 'retain-on-failure' : 'off'
	},
	projects: [
		{
			name: 'setup',
			testMatch: /.*\.setup\.ts/
		},
		{
			// Humo contra un despliegue (T374): solo lectura, sin `setup` ni cuentas de prueba, para no tocar la base de producción.
			name: 'smoke-desplegado',
			testMatch: /smoke\.spec\.ts/,
			use: { ...devices['Desktop Chrome'] }
		},
		{
			name: 'chromium',
			// Los estados de sesión (`e2e/.auth/`) los crea el proyecto `setup` antes de cualquier navegador (T112).
			dependencies: ['setup'],
			use: { ...devices['Desktop Chrome'] },
			// Legal y cierre de administración corren en sus proyectos finales: si no, chocan con admin-contenido (mismo admin, T288).
			testIgnore: [/.*\.setup\.ts/, ADMIN_FINAL_SPEC, LEGAL_LAST_SPEC, ...NIGHTLY_ONLY]
		},
		{
			name: 'firefox',
			// Los estados de sesión (`e2e/.auth/`) los crea el proyecto `setup` antes de cualquier navegador (T112).
			dependencies: ['setup'],
			use: { ...devices['Desktop Firefox'] },
			// Un solo administrador por base (índice one_admin): este spec corre solo en chromium (ver ADMIN_SPEC).
			testIgnore: [/.*.setup.ts/, ADMIN_SPEC, LEGAL_LAST_SPEC, ADMIN_FINAL_SPEC, ...NIGHTLY_ONLY]
		},
		{
			name: 'webkit',
			// Los estados de sesión (`e2e/.auth/`) los crea el proyecto `setup` antes de cualquier navegador (T112).
			dependencies: ['setup'],
			use: { ...devices['Desktop Safari'] },
			testIgnore: [/.*.setup.ts/, ADMIN_SPEC, LEGAL_LAST_SPEC, ADMIN_FINAL_SPEC, ...NIGHTLY_ONLY]
		},
		{
			name: 'mobile-webkit',
			// Los estados de sesión (`e2e/.auth/`) los crea el proyecto `setup` antes de cualquier navegador (T112).
			dependencies: ['setup'],
			use: { ...devices['iPhone 13'] },
			testIgnore: [/.*.setup.ts/, ADMIN_SPEC, LEGAL_LAST_SPEC, ADMIN_FINAL_SPEC, ...NIGHTLY_ONLY]
		},
		{
			name: 'legal-critico7',
			// Corre después de todos los navegadores: publicar una versión legal afecta a todas las cuentas de la base (T288).
			dependencies: ['setup', 'chromium', 'firefox', 'webkit', 'mobile-webkit'],
			testMatch: LEGAL_LAST_SPEC,
			use: { ...devices['Desktop Chrome'] }
		},
		{
			name: 'admin-cierre',
			// Corre el último: el mantenimiento corta el chat de todas las cuentas y el reembolso cambia el saldo de la cuenta del E2E (T322).
			dependencies: ['setup', 'chromium', 'firefox', 'webkit', 'mobile-webkit', 'legal-critico7'],
			testMatch: ADMIN_FINAL_SPEC,
			use: { ...devices['Desktop Chrome'] }
		},
		{
			name: 'visual',
			// Las capturas con sesión necesitan los estados de `e2e/.auth/`, que crea el proyecto `setup` (T112).
			dependencies: ['setup'],
			testMatch: /.*\.visual\.ts/,
			use: { ...devices['Desktop Chrome'] }
		}
	],
	// Contra un despliegue no se levanta servidor local: el smoke solo lee la URL indicada.
	// `webServer` solo existe sin E2E_BASE_URL: con exactOptionalPropertyTypes no se admite `undefined` explícito.
	...(process.env.E2E_BASE_URL === undefined
		? {
				webServer: {
					// Requiere `pnpm build` antes (la cadena `validate` lo hace). El captcha va al simulador de Turnstile del global setup (`MOCK_TURNSTILE_URL`).
					command: 'node build/index.js',
					url: `${WEB_ORIGIN}/api/v1/health`,
					reuseExistingServer: !process.env.CI,
					timeout: 60_000,
					env: {
						APP_ENV: 'test',
						HOST: '127.0.0.1',
						PORT: String(PORT),
						PUBLIC_API_URL: API_ORIGIN,
						PUBLIC_WEB_URL: WEB_ORIGIN,
						BETTER_AUTH_URL: WEB_ORIGIN,
						// Cubre el mayor max_audio_mb (10 MB): el arranque se niega si no (FR-070).
						BODY_SIZE_LIMIT: '10M',
						// Base nueva en cada carga: el servidor arranca siempre con datos vacíos.
						DATABASE_PATH: e2eDbPath,
						BETTER_AUTH_SECRET: randomBytes(32).toString('hex'),
						EMAIL_HASH_KEY: randomBytes(32).toString('hex'),
						LOG_LEVEL: 'debug',
						// Captcha de pruebas: el simulador que arranca el global setup en este mismo puerto.
						MOCK_TURNSTILE_URL: TURNSTILE_MOCK_URL,
						// Un solo servidor para los tres navegadores: el límite de altas por IP (3/24 h) no admite el total de las pruebas.
						E2E_REGISTRATIONS_PER_IP_24H: '100',
						E2E_LOGINS_PER_IP_15MIN: '500'
					}
				}
			}
		: {})
});
