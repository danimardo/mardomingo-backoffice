// Exportación de los metadatos de las operaciones de IA de una cuenta (BE-FR-08; W28). Sin contenido de los mensajes ni
// datos del proveedor: ni modelo, ni coste real, ni identificadores de generación (Historias 15.19). Solo la llama `privacy`.
import { asc, eq } from 'drizzle-orm';
import type { Db } from '$lib/server/db/client';
import { aiOperations } from './schema';

export interface OperationExport {
	readonly id: string;
	readonly appId: string;
	readonly appOperationId: string;
	readonly status: string;
	readonly inputTokens: number | null;
	readonly outputTokens: number | null;
	readonly audioMs: number | null;
	readonly chargedMicro: number;
	readonly truncated: boolean;
	readonly durationMs: number | null;
	readonly appVersion: string | null;
	readonly errorCode: string | null;
	readonly createdAt: string;
	readonly completedAt: string | null;
}

export function exportOperations(deps: { readonly db: Db }, userId: string): OperationExport[] {
	return deps.db
		.select()
		.from(aiOperations)
		.where(eq(aiOperations.userId, userId))
		.orderBy(asc(aiOperations.createdAt), asc(aiOperations.id))
		.all()
		.map((row) => ({
			id: row.id,
			appId: row.appId,
			appOperationId: row.appOperationId,
			status: row.status,
			inputTokens: row.inputTokens,
			outputTokens: row.outputTokens,
			audioMs: row.audioMs,
			chargedMicro: row.chargedMicro,
			truncated: row.truncated,
			durationMs: row.durationMs,
			appVersion: row.appVersion,
			errorCode: row.errorCode,
			createdAt: new Date(row.createdAt).toISOString(),
			completedAt: row.completedAt === null ? null : new Date(row.completedAt).toISOString()
		}));
}
