// Simulador de la API de Resend (R12, R16; FR-098). Responde a `POST /emails` según el escenario activo: `ok` (por
// defecto; devuelve un id), `rejected` (422 con `name`), `rate_limited` y `daily_quota` (429 con `name`), `down` (503). Guarda el cuerpo y la clave de idempotencia de
// cada petición para que las pruebas comprueben qué se envió y que el reintento lleva la misma clave.
import { startMockServer, type MockReply, type MockRequest, type MockServer } from './server';

export function startResendMock(): Promise<MockServer> {
	let counter = 0;
	return startMockServer(
		(request: MockRequest): MockReply => {
			if (request.method !== 'POST' || request.path !== '/emails') return { status: 404 };
			switch (request.scenario) {
				case 'ok':
					counter += 1;
					return { status: 200, body: { id: `re_mock_${String(counter)}` } };
				case 'rejected':
					return {
						status: 422,
						body: { name: 'validation_error', message: 'Simulación de rechazo', statusCode: 422 }
					};
				case 'rate_limited':
					return {
						status: 429,
						body: { name: 'rate_limit_exceeded', message: 'Simulación de límite', statusCode: 429 }
					};
				case 'daily_quota':
					return {
						status: 429,
						body: { name: 'daily_quota_exceeded', message: 'Simulación de cuota', statusCode: 429 }
					};
				case 'down':
					return {
						status: 503,
						body: { name: 'application_error', message: 'Simulación', statusCode: 503 }
					};
				default:
					return { status: 500 };
			}
		},
		{ initialScenario: 'ok' }
	);
}
