// Cliente HTTP de las pruebas. Usa `node:http` porque `fetch` no permite fijar la cabecera `Host`, y la
// separación por host es justo lo que hay que probar (R16).
import { request } from 'node:http';

export interface HttpResult {
	readonly status: number;
	readonly headers: Readonly<Record<string, string | string[] | undefined>>;
	readonly text: string;
}

export interface SendOptions {
	readonly method?: string;
	/** Valor de `Host`; por defecto, el de la propia `baseUrl`. */
	readonly host?: string;
	readonly headers?: Readonly<Record<string, string>>;
	readonly body?: string;
}

export function send(
	baseUrl: string,
	path: string,
	options: SendOptions = {}
): Promise<HttpResult> {
	const url = new URL(baseUrl);
	return new Promise((resolve, reject) => {
		const req = request(
			{
				host: url.hostname,
				port: url.port,
				path,
				method: options.method ?? 'GET',
				headers: { host: options.host ?? url.host, ...options.headers }
			},
			(res) => {
				const chunks: Buffer[] = [];
				res.on('data', (chunk: Buffer) => {
					chunks.push(chunk);
				});
				res.on('end', () => {
					resolve({
						status: res.statusCode ?? 0,
						headers: res.headers,
						text: Buffer.concat(chunks).toString('utf8')
					});
				});
			}
		);
		req.on('error', reject);
		req.end(options.body);
	});
}

/** Cuerpo JSON sin tipar: las pruebas afirman su forma con `toMatchObject` o `toEqual`. */
export function jsonOf(result: HttpResult): unknown {
	const parsed: unknown = JSON.parse(result.text);
	return parsed;
}
