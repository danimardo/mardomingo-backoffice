// Constantes compartidas por la configuración de Playwright y por el global setup: el puerto fijo del simulador de
// Turnstile, que el servidor de pruebas recibe en `MOCK_TURNSTILE_URL`.
export const TURNSTILE_MOCK_PORT = 7391;
export const TURNSTILE_MOCK_URL = `http://127.0.0.1:${String(TURNSTILE_MOCK_PORT)}`;
