// Simulador de Turnstile (R12; BE-FR-01 CA3). Responde a `POST /turnstile/v0/siteverify` según el escenario activo:
// `valid` (por defecto), `invalid` (token rechazado), `down` (503) y `broken` (respuesta que no encaja con el esquema).
import { startMockServer, type MockReply, type MockRequest, type MockServer } from './server';

/** Puerto fijo opcional: el E2E lo necesita para apuntar el servidor de pruebas a una dirección conocida. */
export function startTurnstileMock(port?: number): Promise<MockServer> {
	return startMockServer(
		(request: MockRequest): MockReply => {
			if (request.method !== 'POST' || request.path !== '/turnstile/v0/siteverify')
				return { status: 404 };
			switch (request.scenario) {
				case 'valid':
					return { status: 200, body: { success: true } };
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
