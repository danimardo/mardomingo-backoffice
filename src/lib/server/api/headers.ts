// Cabeceras comunes de la API (contracts/api-v1.md 1.3). `X-Request-Id` y las de seguridad las añade el
// hook `handle` a todas las respuestas; aquí solo va lo específico de JSON de la API.

/** Sin caché en ninguna respuesta de la API: reflejan configuración editable y datos de cuenta. */
export const API_NO_STORE_HEADERS: Readonly<Record<string, string>> = Object.freeze({
	'cache-control': 'no-store'
});

export interface JsonInit {
	readonly status: number;
	readonly headers?: Readonly<Record<string, string>>;
}

export function jsonResponse(body: unknown, init: JsonInit): Response {
	return new Response(JSON.stringify(body), {
		status: init.status,
		headers: {
			'content-type': 'application/json; charset=utf-8',
			...API_NO_STORE_HEADERS,
			...init.headers
		}
	});
}
