// Simulador de la lista pública de dominios desechables (T340): un dominio por línea en el escenario `ok` (120 dominios, con una
// línea en blanco y otra de comentario); `short` (3 dominios, lista que no se usa); `down` (503).
import { startMockServer, type MockReply, type MockRequest, type MockServer } from './server';

export const BLOCKLIST_PATH = '/disposable_email_blocklist.conf';

export function blocklistText(count: number): string {
	const lines = ['# lista de prueba', ''];
	for (let index = 0; index < count; index += 1) lines.push(`desechable${String(index)}.example`);
	return lines.join('\n') + '\n';
}

export function startBlocklistMock(): Promise<MockServer> {
	return startMockServer(
		(request: MockRequest): MockReply => {
			if (request.method !== 'GET' || request.path !== BLOCKLIST_PATH) return { status: 404 };
			switch (request.scenario) {
				case 'ok':
					return { status: 200, text: blocklistText(120), contentType: 'text/plain' };
				case 'short':
					return { status: 200, text: blocklistText(3), contentType: 'text/plain' };
				case 'down':
					return { status: 503, text: 'no disponible', contentType: 'text/plain' };
				default:
					return { status: 500 };
			}
		},
		{ initialScenario: 'ok' }
	);
}
