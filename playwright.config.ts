// Configuración de Playwright (T-PLAY-001; R09, R16). Arranca la aplicación construida con un entorno explícito:
// sin `.env` ni sintaxis de shell, base de datos temporal y secretos aleatorios generados al cargar esta
// configuración. La web y la API se sirven desde el mismo proceso, en hosts distintos (localhost y 127.0.0.1),
// para que la separación por host se ejerza igual que en producción.
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

const nightly = process.env.E2E_NIGHTLY === '1';

/** Spec de administración con un único administrador por base: solo en chromium (T314). */
const ADMIN_SPEC = /admin-contenido\.spec\.ts/;

export default defineConfig({
	testDir: 'e2e',
	globalSetup: './e2e/global-setup.ts',
	outputDir: join(E2E_DIR, 'artifacts'),
	fullyParallel: true,
	forbidOnly: Boolean(process.env.CI),
	retries: process.env.CI ? 1 : 0,
	reporter: [['list'], ['html', { open: 'never', outputFolder: join(E2E_DIR, 'report') }]],
	use: {
		baseURL: WEB_ORIGIN,
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
			name: 'chromium',
			use: { ...devices['Desktop Chrome'] },
			testIgnore: /.*\.setup\.ts/
		},
		{
			name: 'firefox',
			use: { ...devices['Desktop Firefox'] },
			// Un solo administrador por base (índice one_admin): este spec corre solo en chromium (ver ADMIN_SPEC).
			testIgnore: [/.*\.setup\.ts/, ADMIN_SPEC]
		},
		{
			name: 'webkit',
			use: { ...devices['Desktop Safari'] },
			testIgnore: [/.*\.setup\.ts/, ADMIN_SPEC]
		},
		{
			name: 'mobile-webkit',
			use: { ...devices['iPhone 13'] },
			testIgnore: [/.*\.setup\.ts/, ADMIN_SPEC]
		},
		{
			name: 'visual',
			testMatch: /.*\.visual\.ts/,
			use: { ...devices['Desktop Chrome'] }
		}
	],
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
});
