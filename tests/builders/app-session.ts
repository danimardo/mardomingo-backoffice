// Sesiones de app para las pruebas (T137): login real por el servicio, con app, equipo y versión. Reutiliza el montaje de
// cuentas y la app `secretario` ya sembrada; no crea otra app.
import { SEEDED_APP_ID } from '../setup/integration.global-setup';
import {
	EMAIL,
	IP,
	PASSWORD,
	registration,
	verificationTokenFor,
	type AccountsFixture
} from './accounts';
import type { AppLoginInput } from '$lib/server/features/accounts';

export const DEVICE_NAME = 'Portátil de prueba';
export const APP_VERSION = '4.0.0';

/** Entrada del login de app para `secretario`, con su equipo y su versión. */
export function appLogin(
	overrides: Partial<AppLoginInput> = {},
	email: string = EMAIL
): AppLoginInput {
	return {
		email,
		password: PASSWORD,
		remoteIp: IP,
		appId: SEEDED_APP_ID,
		deviceName: DEVICE_NAME,
		appVersion: APP_VERSION,
		...overrides
	};
}

/** Registra y verifica una cuenta, para que pueda entrar por la app. */
export async function verifiedAccount(
	fixture: AccountsFixture,
	email: string = EMAIL
): Promise<void> {
	await fixture.accounts.register(registration({ email }));
	await fixture.accounts.verifyEmail(verificationTokenFor(fixture.mail, email));
}

/** Cabeceras de una petición de la API con su Bearer. */
export function bearer(token: string): Headers {
	return new Headers({ authorization: `Bearer ${token}` });
}
