// Caché del documento OpenAPI: se genera la primera vez y no cambia mientras el proceso vive (el origen
// público viene del entorno validado al arrancar). Es estado de módulo permitido: solo lectura tras
// generarse, igual que `composition.cache.ts`.
import { buildOpenApiDocument } from './openapi';

let serialized: string | undefined;

export function openApiJson(publicApiUrl: string): string {
	serialized ??= JSON.stringify(buildOpenApiDocument(publicApiUrl));
	return serialized;
}
