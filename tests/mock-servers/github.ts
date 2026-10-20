// Simulador de la API de GitHub para los releases de un repositorio (L14; T339). En `ok`, dos páginas unidas por la cabecera
// `Link rel="next"`; `down` (503) y `invalid` (forma que no encaja). Guarda las peticiones para comprobar cabeceras y páginas.
import { startMockServer, type MockReply, type MockRequest, type MockServer } from './server';

export const GITHUB_RELEASES_PATH = '/repos/mardomingo/secretario-instalador/releases';

function release(counts: readonly number[]) {
	return { assets: counts.map((download_count) => ({ download_count })) };
}

export function startGitHubMock(): Promise<MockServer> {
	return startMockServer(
		(request: MockRequest): MockReply => {
			if (request.method !== 'GET' || request.path !== GITHUB_RELEASES_PATH) return { status: 404 };
			switch (request.scenario) {
				case 'ok':
					if (request.query === '?page=2') return { status: 200, body: [release([7])] };
					return {
						status: 200,
						body: [release([40, 2])],
						headers: {
							link: `<http://${String(request.headers.host)}${GITHUB_RELEASES_PATH}?page=2>; rel="next"`
						}
					};
				case 'down':
					return { status: 503, body: { message: 'no disponible' } };
				case 'invalid':
					return { status: 200, body: [{ assets: 'no es una lista' }] };
				default:
					return { status: 500, body: { message: 'error' } };
			}
		},
		{ initialScenario: 'ok' }
	);
}
