// Simulador de Turnstile (R12; BE-FR-01 CA3). Responde a `POST /turnstile/v0/siteverify` según el escenario activo:
// `valid` (por defecto), `invalid` (token rechazado), `down` (503), `broken` (respuesta que no encaja con el esquema),
// `bare` (éxito sin hostname ni action), `wrong_hostname` y `wrong_action` (token válido obtenido en otro sitio o en otro formulario; C-25). Como Cloudflare, una
// respuesta correcta lleva el `hostname` donde se resolvió el widget y la `action` del widget.
import { REGISTER_CAPTCHA_ACTION } from '../../src/lib/shared/captcha';
import { startMockServer, type MockReply, type MockRequest, type MockServer } from './server';

/** Puerto fijo opcional: el E2E lo necesita para apuntar el servidor de pruebas a una dirección conocida. */
/** Host web que el simulador dice haber visto en el widget. */
export const MOCK_TURNSTILE_HOSTNAME = 'cuenta.mardomingo.test';

export function startTurnstileMock(port?: number): Promise<MockServer> {
	return startMockServer(
		(request: MockRequest): MockReply => {
			if (request.method !== 'POST' || request.path !== '/turnstile/v0/siteverify')
				return { status: 404 };
			switch (request.scenario) {
				case 'valid':
					return {
						status: 200,
						body: {
							success: true,
							hostname: MOCK_TURNSTILE_HOSTNAME,
							action: REGISTER_CAPTCHA_ACTION
						}
					};
				case 'bare':
					return { status: 200, body: { success: true } };
				case 'wrong_hostname':
					return {
						status: 200,
						body: { success: true, hostname: 'otro-sitio.example', action: REGISTER_CAPTCHA_ACTION }
					};
				case 'wrong_action':
					return {
						status: 200,
						body: { success: true, hostname: MOCK_TURNSTILE_HOSTNAME, action: 'login' }
					};
				case 'invalid':
					return {
						status: 200,
						body: { success: false, 'error-codes': ['invalid-input-response'] }
					};
				case 'down':
					return { status: 503, body: { error: 'unavailable' } };
				default:
					return { status: 200, body: { unexpected: true } };
			}
		},
		{ initialScenario: 'valid', ...(port === undefined ? {} : { port }) }
	);
}
