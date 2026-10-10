// Cualquier ruta de la API sin implementar: `404 NOT_FOUND` en el formato 7.1 (contracts/api-v1.md 1.4; D-19).
import type { RequestHandler } from '@sveltejs/kit';
import { apiErrorResponse } from '$lib/server/api/errors';

export const fallback: RequestHandler = () => apiErrorResponse('NOT_FOUND');
