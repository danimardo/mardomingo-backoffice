// Contrato de E06 `POST /api/v1/me/accept-terms` (contracts/api-v1.md E06; BE-FR-70/CA2; T278). Entre 1 y 4 documentos sin repetir.
import { z } from 'zod';
import { ACCEPTABLE_DOCUMENTS } from './schema';

export const AcceptTermsBody = z
	.object({
		documents: z
			.array(
				z
					.object({
						document: z.enum(ACCEPTABLE_DOCUMENTS),
						version: z.string().min(1).max(32)
					})
					.strict()
			)
			.min(1)
			.max(4)
	})
	.strict()
	.refine(
		(body) => new Set(body.documents.map((item) => item.document)).size === body.documents.length,
		{ message: 'documento repetido', path: ['documents'] }
	);
