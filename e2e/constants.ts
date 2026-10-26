// Constantes compartidas por la configuración de Playwright y por el global setup: el puerto fijo del simulador de
// Turnstile, que el servidor de pruebas recibe en `MOCK_TURNSTILE_URL`.
export const TURNSTILE_MOCK_PORT = 7391;
export const TURNSTILE_MOCK_URL = `http://127.0.0.1:${String(TURNSTILE_MOCK_PORT)}`;

/** Cuenta del panel sembrada para el E2E (T250): los datos los crea `panelAccountFixture` con los servicios. */
export const PANEL_E2E_EMAIL = 'panel.e2e@ejemplo.es';
export const PANEL_E2E_PASSWORD = 'contraseña-panel-e2e-123';

/** Límites de la base E2E (T250): la siembra los escribe porque el arranque no sobrescribe los ajustes ya presentes. */
export const E2E_REGISTRATIONS_PER_IP_24H = 100;
export const E2E_LOGINS_PER_IP_15MIN = 500;

/**
 * Única cuenta administradora de las pruebas E2E de la base de una ejecución (índice `one_admin`). Los specs que la
 * necesitan la comparten y no se degradan entre sí (T288, T314).
 */
export const E2E_ADMIN_EMAIL = 'admin-contenido.e2e@gmail.com';

/**
 * Motivo de saltar en WebKit las pruebas que escriben el tema o los efectos y los comprueban tras recargar. La cookie es
 * `Secure` (decisión de seguridad, `tests/http/security-headers.test.ts`) y WebKit no la envía sobre `http://localhost`, que es
 * el origen de las pruebas: la persistencia se verifica en Chromium y Firefox; en producción la web es https.
 */
export const WEBKIT_SECURE_COOKIE_SKIP =
	'WebKit no envía cookies Secure sobre http://localhost: la persistencia se prueba en Chromium y Firefox';

/** Origen web de la suite local (`playwright.config.ts`): sin él, el humo corre contra un despliegue (T374). */
export const LOCAL_WEB_ORIGIN = 'http://localhost:7390';
