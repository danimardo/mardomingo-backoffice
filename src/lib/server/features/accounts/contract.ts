// Contrato de la API de cuentas para las apps (contracts/api-v1.md E02–E05, 3.1, 3.2; T129). Los esquemas validan lo que
// entra en las rutas y describen lo que sale en OpenAPI. Los ids llevan prefijo `Accounts` para no chocar con otras
// funcionalidades.
import * as z from 'zod';

/** E02: login de app. Esquema estricto: un campo de más es un error de validación. */
export const AppLoginBody = z
	.strictObject({
		email: z.email().max(254),
		password: z.string().min(1).max(128)
	})
	.meta({ id: 'AccountsLoginBody' });

/** E05: reenvío de verificación. La respuesta es siempre `202` sin cuerpo, así que solo el cuerpo de entrada tiene forma. */
export const ResendVerificationBody = z
	.strictObject({ email: z.email().max(254) })
	.meta({ id: 'AccountsResendVerificationBody' });

/** Pendientes de aceptar (3.2): documento y versión vigente que la cuenta aún no ha aceptado. */
export const PendingAcceptanceSchema = z
	.object({
		document: z.enum(['terms', 'privacy', 'aup']),
		version: z.string()
	})
	.meta({ id: 'AccountsPendingAcceptance' });

/** E02, respuesta: token de la sesión de la app, usuario, caducidad y documentos pendientes. */
export const AppLoginResponse = z
	.object({
		token: z.string(),
		expiresAt: z.iso.datetime(),
		user: z.object({ email: z.string(), roles: z.array(z.string()) }),
		pendingAcceptances: z.array(PendingAcceptanceSchema)
	})
	.meta({ id: 'AccountsAppLoginResponse' });
