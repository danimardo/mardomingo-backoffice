// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
import type { Appearance } from '$lib/appearance/preferences';
import type { Logger } from '$lib/server/logging/logger';
import type { SessionUser } from '$lib/server/features/accounts';

declare global {
	namespace App {
		/** Error que devuelve `handleError`: texto apto para mostrar y código de referencia para soporte. */
		interface Error {
			message: string;
			requestId: string;
		}
		interface Locals {
			requestId: string;
			log: Logger;
			appearance: Appearance;
			/** App de `X-App-Id` en la API (paso «app», L04); `null` en la web y en `/api/v1/health` y `openapi.json`. */
			app: {
				readonly id: string;
				readonly slug: string;
				readonly name: string;
				readonly allowedOrigins: readonly string[];
				readonly version: string | null;
				readonly deviceName: string | null;
			} | null;
			/** Por qué no hay app en la API: `X-App-Id` desconocida o mal formada, o app desactivada. `requireApp` lo usa. */
			appRejection: 'unknown_app' | 'app_disabled' | null;
			/** Usuario de la sesión: por cookie en la web, por Bearer en la API. `null` si no hay sesión válida. */
			user: SessionUser | null;
			/** `appId` es la app con la que se abrió la sesión (`null` en las sesiones web). */
			session: { readonly id: string; readonly appId: string | null } | null;
		}
		// interface PageData {}
		// interface PageState {}
		// interface Platform {}
	}
}

export {};
