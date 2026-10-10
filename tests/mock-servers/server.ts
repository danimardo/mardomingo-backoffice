// Marco de servidores simulados (T037, R16): HTTP real con `node:http` en un puerto libre o fijo.
// Cada simulador define una respuesta por petición; `POST /__scenario` cambia el escenario activo.
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';

export interface MockRequest {
	readonly method: string;
	readonly path: string;
	readonly body: string;
	readonly scenario: string;
}

export interface MockReply {
	readonly status: number;
	readonly body?: unknown;
	readonly delayMs?: number;
}

export interface MockServer {
	readonly url: string;
	readonly requests: readonly MockRequest[];
	scenario(name: string): void;
	close(): Promise<void>;
}

const CONTROL_PATH = '/__scenario';

export function startMockServer(
	handler: (request: MockRequest) => MockReply,
	options: { readonly port?: number; readonly initialScenario?: string } = {}
): Promise<MockServer> {
	const requests: MockRequest[] = [];
	let scenario = options.initialScenario ?? 'default';

	const server: Server = createServer((req, res) => {
		void serve(req, res);
	});

	async function serve(req: IncomingMessage, res: ServerResponse): Promise<void> {
		const body = await readBody(req);
		if (req.method === 'POST' && req.url === CONTROL_PATH) {
			scenario = body.trim();
			res.writeHead(204).end();
			return;
		}

		const request: MockRequest = {
			method: req.method ?? 'GET',
			path: req.url ?? '/',
			body,
			scenario
		};
		requests.push(request);
		const reply = handler(request);
		if (reply.delayMs !== undefined) await delay(reply.delayMs);
		res.writeHead(reply.status, { 'content-type': 'application/json; charset=utf-8' });
		res.end(reply.body === undefined ? '' : JSON.stringify(reply.body));
	}

	return new Promise((resolve, reject) => {
		server.once('error', reject);
		server.listen(options.port ?? 0, '127.0.0.1', () => {
			const address = server.address();
			if (address === null || typeof address === 'string') {
				reject(new Error('El simulador no obtuvo puerto.'));
				return;
			}
			resolve({
				url: `http://127.0.0.1:${String(address.port)}`,
				requests,
				scenario(name) {
					scenario = name;
				},
				close: () =>
					new Promise<void>((done) => {
						server.close(() => {
							done();
						});
					})
			});
		});
	});
}

function readBody(req: IncomingMessage): Promise<string> {
	return new Promise((resolve, reject) => {
		let body = '';
		req.setEncoding('utf8');
		req.on('data', (chunk: string) => {
			body += chunk;
		});
		req.on('end', () => {
			resolve(body);
		});
		req.on('error', reject);
	});
}

function delay(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}
