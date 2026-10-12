// Documento OpenAPI 3.1 de la API `/api/v1` (contracts/api-v1.md E13–E14, 1.4). Se genera a partir de los
// mismos esquemas Zod que validan las peticiones. En L01 solo describe el healthcheck y el formato de error.
import * as z from 'zod';
import { createDocument } from 'zod-openapi';
import {
	AppLoginBody,
	AppLoginResponse,
	ResendVerificationBody
} from '$lib/server/features/accounts';
import { ChatRequestBody, ImageRequestBody } from '$lib/server/features/ai';
import {
	DefaultsResponse,
	GetSyncResponse,
	PutSyncBody,
	PutSyncResponse
} from '$lib/server/features/sync';

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
			'/ai/transcribe': {
				post: {
					summary: 'Transcripción de un audio (multipart; Bearer; Idempotency-Key opcional)',
					requestBody: {
						required: true,
						content: {
							'multipart/form-data': {
								schema: {
									type: 'object',
									required: ['operation', 'file'],
									properties: {
										operation: { type: 'string' },
										file: {
											type: 'string',
											format: 'binary',
											description: 'Audio, acotado por max_audio_mb de la app'
										}
									}
								}
							}
						}
					},
					responses: {
						'200': {
							description:
								'Texto, proveedor usado (primary o backup), segundos, saldo; nunca el modelo'
						},
						'400': {
							description: 'Operación, fichero o Idempotency-Key no válidos, o audio ilegible'
						},
						'401': { description: 'Sin sesión válida para la app' },
						'402': { description: 'Saldo insuficiente' },
						'413': {
							description: 'Audio demasiado largo (AUDIO_TOO_LONG) o fichero demasiado grande'
						},
						'502': {
							description:
								'Fallaron Voxtral y el respaldo (TRANSCRIPTION_FAILED, con motivos saneados)'
						}
					}
				}
			},
			'/ai/image': {
				post: {
					summary: 'Imagen generada por el modelo, como data URL (no se guarda)',
					requestBody: { content: { 'application/json': { schema: ImageRequestBody } } },
					responses: {
						'200': { description: 'Imagen como data URL, saldo y créditos cobrados' },
						'400': { description: 'Validación de la operación o de los campos' },
						'402': { description: 'Saldo insuficiente' },
						'502': { description: 'El modelo no devolvió imagen o falló' }
					}
				}
			},
			'/ai/chat': {
				post: {
					summary: 'Chat de una operación de IA (Bearer; Idempotency-Key opcional, UUID)',
					requestBody: { content: { 'application/json': { schema: ChatRequestBody } } },
					responses: {
						'200': {
							description:
								'Texto o JSON, saldo resumido y créditos cobrados; nunca modelo ni proveedor'
						},
						'400': {
							description: 'Validación de la operación, la forma o la cabecera Idempotency-Key'
						},
						'401': { description: 'Sin sesión válida para la app' },
						'402': { description: 'Saldo insuficiente' },
						'403': { description: 'Documentos legales pendientes' },
						'409': { description: 'Petición en curso o ya entregada con esa clave' },
						'413': { description: 'Operación demasiado cara o contenido demasiado grande' },
						'429': { description: 'Límite de frecuencia' },
						'502': { description: 'Error del proveedor o moderación' },
						'503': { description: 'Mantenimiento o app desactivada' },
						'504': { description: 'Tiempo agotado con el proveedor' }
					}
				}
			},
			'/sync': {
				get: {
					summary: 'Documento sincronizado de la app (Bearer; siembra la primera vez)',
					responses: {
						'200': {
							description: 'Revisión y documento',
							content: { 'application/json': { schema: GetSyncResponse } }
						},
						'401': { description: 'Sin sesión válida para la app' },
						'403': { description: 'Documentos legales pendientes' },
						'426': { description: 'Versión de la app inferior a la mínima' },
						'503': { description: 'Mantenimiento' }
					}
				},
				put: {
					summary: 'Sustituye el documento; If-Match obligatorio con la revisión leída',
					requestBody: { content: { 'application/json': { schema: PutSyncBody } } },
					responses: {
						'200': {
							description: 'Nueva revisión',
							content: { 'application/json': { schema: PutSyncResponse } }
						},
						'400': {
							description: 'If-Match ausente o mal formado, o documento no válido para el esquema'
						},
						'401': { description: 'Sin sesión válida para la app' },
						'403': { description: 'Documentos legales pendientes' },
						'412': { description: 'SYNC_CONFLICT: la revisión no coincide; relee y reintenta' },
						'413': { description: 'El documento supera max_sync_doc_kb' },
						'426': { description: 'Versión de la app inferior a la mínima' },
						'503': { description: 'Mantenimiento' }
					}
				}
			},
			'/defaults': {
				get: {
					summary: 'Predeterminados vigentes de la app (solo exige versión)',
					responses: {
						'200': {
							description: 'Predeterminados',
							content: { 'application/json': { schema: DefaultsResponse } }
						},
						'426': { description: 'Versión de la app inferior a la mínima' }
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
