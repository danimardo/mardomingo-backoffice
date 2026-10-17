// Catálogo de eventos de `ai` (contracts/log-events.md; T165). Sin contenido, sin mensajes del proveedor ni secretos: solo
// identificadores, motivos y contadores.
import type { LogEventMeta } from '$lib/server/logging/events';

export interface AiLogFields {
	'ai.operation.started': { operationId: string; operation: string };
	'ai.operation.completed': {
		operationId: string;
		operation: string;
		status: 'ok';
		reason?: 'truncated' | 'structured_invalid';
		provider: string;
	};
	'ai.operation.rejected': {
		operation: string;
		reason:
			| 'unknown_operation'
			| 'validation'
			| 'payload_too_large'
			| 'operation_too_expensive'
			| 'request_in_progress'
			| 'duplicate_request'
			| 'audio_too_long'
			| 'audio_unreadable';
	};
	'ai.operation.failed': {
		operationId: string;
		operation: string;
		errorCode: 'PROVIDER_ERROR' | 'PROVIDER_TIMEOUT' | 'TRANSCRIPTION_FAILED';
	};
	'ai.operation.cancelled': {
		operationId: string;
		operation: string;
		status: 'cancelled' | 'undelivered';
	};
	'ai.cancellation_cost.recorded': {
		operationId: string;
		reason: 'from_response' | 'from_generation_lookup';
	};
	'ai.operation.interrupted': { count: number };
	'ai.provider.billing_error': { provider: 'mistral'; httpStatus: number | null };
	'ai.transcription.backup_used': { operationId: string; provider: 'openrouter' };
	'ai.temp_file.cleanup_failed': { operationId: string };
	'ai.operation.flagged': { operationId: string; operation: string; provider: string };
	'ai.flagged.threshold_reached': { count: number };
	'ai.provider.retry': {
		operationId: string;
		provider: string;
		attempt: number;
		httpStatus: number | null;
		errorCode: string;
	};
	'ai.provider.fallback': { operationId: string; provider: string; model: string; attempt: number };
	'ai.provider.invalid_response': {
		operationId: string;
		provider: string;
		model: string;
		reason: 'schema_invalid' | 'empty';
	};
	'ai.cost.estimated': { operationId: string; provider: string; model: string };
	'ai.idempotency.replayed': { operationId: string; reason: 'undelivered_retry' };
	'ai.models.refreshed': { provider: 'openrouter'; count: number };
	'ai.model.retired': { operation: string; model: string };
	'ai.model.price_changed': { operation: string; model: string };
}

export type AiLogEventCode = keyof AiLogFields;

export const AI_LOG_EVENTS = Object.freeze({
	'ai.operation.started': { level: 'debug', msg: 'Operación de IA iniciada' },
	'ai.operation.completed': { level: 'info', msg: 'Operación de IA completada' },
	'ai.operation.rejected': { level: 'info', msg: 'Operación de IA rechazada' },
	'ai.operation.failed': { level: 'error', msg: 'Fallaron todos los proveedores' },
	'ai.operation.cancelled': { level: 'info', msg: 'Operación de IA cancelada por el cliente' },
	'ai.cancellation_cost.recorded': {
		level: 'info',
		msg: 'Coste de una operación cancelada registrado'
	},
	'ai.operation.interrupted': { level: 'warn', msg: 'Operaciones interrumpidas por reinicio' },
	'ai.provider.billing_error': { level: 'warn', msg: 'Error de facturación del proveedor' },
	'ai.transcription.backup_used': { level: 'warn', msg: 'Transcripción servida por el backup' },
	'ai.temp_file.cleanup_failed': { level: 'error', msg: 'No se pudo borrar el temporal de audio' },
	'ai.operation.flagged': {
		level: 'warn',
		msg: 'Contenido rechazado por moderación del proveedor'
	},
	'ai.flagged.threshold_reached': {
		level: 'warn',
		msg: 'Usuario con operaciones marcadas por encima del umbral'
	},
	'ai.provider.retry': { level: 'debug', msg: 'Reintento con el proveedor' },
	'ai.provider.fallback': { level: 'warn', msg: 'Modelo de respaldo utilizado' },
	'ai.provider.invalid_response': { level: 'warn', msg: 'Respuesta inválida del proveedor' },
	'ai.cost.estimated': { level: 'warn', msg: 'Coste real estimado por precios del modelo' },
	'ai.idempotency.replayed': { level: 'info', msg: 'Repetición de operación no entregada' },
	'ai.models.refreshed': { level: 'info', msg: 'Caché de modelos actualizada' },
	'ai.model.retired': { level: 'warn', msg: 'Modelo asignado retirado o incompatible' },
	'ai.model.price_changed': { level: 'warn', msg: 'Precio de un modelo asignado cambiado' }
} as const satisfies Record<AiLogEventCode, LogEventMeta>);
