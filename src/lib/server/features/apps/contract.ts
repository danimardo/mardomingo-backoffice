// Cabeceras comunes de la API `/api/v1` (contracts/api-v1.md 1.2; T129). Las valida Zod. Un valor mal formado en un
// campo opcional (`X-App-Version`, `X-Device-Name`) se descarta: la petición sigue y la respuesta no lo refleja. `X-App-Id`
// es obligatorio y se valida en el paso «app» de `hooks.server.ts`.
import * as z from 'zod';

const APP_ID = z.string().regex(/^[a-z0-9][a-z0-9-]{0,62}$/);
const APP_VERSION = z.string().regex(/^\d{1,4}\.\d{1,4}\.\d{1,4}$/);
const DEVICE_NAME = z
	.string()
	.trim()
	.min(1)
	.max(100)
	.refine((value) => !/\p{Cc}/u.test(value));

export type AppHeaders =
	| {
			readonly ok: true;
			readonly appId: string;
			readonly version: string | null;
			readonly deviceName: string | null;
	  }
	| { readonly ok: false };

/** Lee `X-App-Id`, `X-App-Version` y `X-Device-Name`. `ok: false` solo si falta o es mal formado `X-App-Id`. */
export function appHeadersOf(headers: Headers): AppHeaders {
	const appId = APP_ID.safeParse(headers.get('x-app-id'));
	if (!appId.success) return { ok: false };
	const version = APP_VERSION.safeParse(headers.get('x-app-version'));
	const deviceName = DEVICE_NAME.safeParse(headers.get('x-device-name'));
	return {
		ok: true,
		appId: appId.data,
		version: version.success ? version.data : null,
		deviceName: deviceName.success ? deviceName.data : null
	};
}
