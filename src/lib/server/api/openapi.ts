// Documento OpenAPI 3.1 de la API `/api/v1` (contracts/api-v1.md E13–E14, 1.4). Se genera a partir de los
// mismos esquemas Zod que validan las peticiones. En L01 solo describe el healthcheck y el formato de error.
import * as z from 'zod';
import { createDocument } from 'zod-openapi';

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
			}
		},
		components: {
			schemas: { ApiError: apiErrorSchema }
		}
	});
}
