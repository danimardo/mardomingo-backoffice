// Documento OpenAPI 3.1 de la API `/api/v1` (contracts/api-v1.md E13–E14, 1.4). Se genera a partir de los
// mismos esquemas Zod que validan las peticiones. En L01 solo describe el healthcheck y el formato de error.
import * as z from 'zod';
import { createDocument } from 'zod-openapi';
import {
	AppLoginBody,
	AppLoginResponse,
	ResendVerificationBody
} from '$lib/server/features/accounts';

export const apiErrorSchema = z
	.object({
		error: z.object({
			code: z.string().meta({ description: 'Código de la tabla 2 de api-v1.md' }),
			message: z.string(),
			details: z.record(z.string(), z.unknown())
		})
	})
	.meta({ id: 'ApiError' });

export const healthSchema = z.object({ status: z.enum(['ok', 'unavailable']) }).meta({
	id: 'Health'
});

export function buildOpenApiDocument(publicApiUrl: string) {
	return createDocument({
		openapi: '3.1.0',
		info: {
			title: 'Cuenta Mardomingo — API v1',
			version: '1.0.0',
			description: 'API de Cuenta Mardomingo para las apps cliente.'
		},
		servers: [{ url: `${publicApiUrl}/api/v1` }],
		paths: {
			'/health': {
				get: {
					summary: 'Estado de la aplicación',
					responses: {
						'200': {
							description: 'Aplicación operativa',
							content: { 'application/json': { schema: healthSchema } }
						},
						'503': {
							description: 'Base de datos no disponible',
							content: { 'application/json': { schema: healthSchema } }
						}
					}
				}
			},
			'/auth/login': {
				post: {
					summary: 'Inicio de sesión de una app (X-App-Id obligatorio)',
					requestBody: { content: { 'application/json': { schema: AppLoginBody } } },
					responses: {
						'200': {
							description: 'Sesión abierta, ligada a la app, el equipo y la versión',
							content: { 'application/json': { schema: AppLoginResponse } }
						},
						'400': { description: 'Validación o cabecera X-App-Id' },
						'401': { description: 'Credenciales erróneas o cuenta sin verificar' },
						'503': { description: 'App desactivada' }
					}
				}
			},
			'/auth/logout': {
				post: {
					summary: 'Cierre de la sesión del token (sin cuerpo)',
					responses: {
						'204': { description: 'Sesión revocada' },
						'401': { description: 'Sin sesión válida' }
					}
				}
			},
			'/auth/resend-verification': {
				post: {
					summary: 'Reenvío del email de verificación (siempre 202)',
					requestBody: {
						content: { 'application/json': { schema: ResendVerificationBody } }
					},
					responses: {
						'202': { description: 'Recibido, exista o no la cuenta' },
						'400': { description: 'Validación' }
					}
				}
			}
		},
		components: {
			schemas: { ApiError: apiErrorSchema }
		}
	});
}
