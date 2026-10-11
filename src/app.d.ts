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
			/** Se rellena con la app de `X-App-Id` en L04. */
			app: null;
			/** Usuario de la sesión web (cookie), o `null` si no hay sesión válida (L03). */
			user: SessionUser | null;
			session: { readonly id: string } | null;
		}
		// interface PageData {}
		// interface PageState {}
		// interface Platform {}
	}
}

export {};
