// Simulador del servicio de datos del BCE (R13; Historias 15.23; T149). Responde a `GET …/service/data/EXR/D.USD.EUR.SP00.A`
// con el CSV de la última observación según el escenario activo: `ok` (1,0870 con fecha 9-oct-2026), `empty` (200 sin
// publicación, como un fin de semana), `invalid` (CSV que no encaja), `stale` (una observación antigua), `http` (500) y
// `down` (503). Guarda las peticiones para comprobar la URL y la cabecera.
import { startMockServer, type MockReply, type MockRequest, type MockServer } from './server';

export const ECB_PATH = '/service/data/EXR/D.USD.EUR.SP00.A';
const HEADER = 'KEY,FREQ,CURRENCY,CURRENCY_DENOM,EXR_TYPE,EXR_SUFFIX,TIME_PERIOD,OBS_VALUE';

function observation(timePeriod: string, rate: string): string {
	return `${HEADER}\nEXR.D.USD.EUR.EUR.SP00.A,D,USD,EUR,SP00,A,${timePeriod},${rate}\n`;
}

export function startEcbMock(): Promise<MockServer> {
	return startMockServer(
		(request: MockRequest): MockReply => {
			if (request.method !== 'GET' || request.path !== ECB_PATH) return { status: 404 };
			switch (request.scenario) {
				case 'ok':
					return {
						status: 200,
						text: observation('2026-10-09', '1.0870'),
						contentType: 'text/csv'
					};
				case 'empty':
					return { status: 200, text: '', contentType: 'text/csv' };
				case 'invalid':
					return { status: 200, text: 'esto no es un CSV del BCE\n', contentType: 'text/csv' };
				case 'stale':
					return {
						status: 200,
						text: observation('2026-10-02', '1.0850'),
						contentType: 'text/csv'
					};
				case 'down':
					return { status: 503, text: 'no disponible', contentType: 'text/plain' };
				default:
					return { status: 500, text: 'error', contentType: 'text/plain' };
			}
		},
		{ initialScenario: 'ok' }
	);
}
