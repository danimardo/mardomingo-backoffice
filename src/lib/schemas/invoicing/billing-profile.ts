// Perfil de facturación opcional (BE-FR-74; T229). `z.strictObject`: ningún campo fuera de la lista. Los mensajes son
// claves de Paraglide (`invoicing_…`), para que la interfaz los traduzca.
import * as z from 'zod';
import { isValidEsTaxId, isValidVatFormat } from './tax-id';

export const BillingProfile = z.strictObject({
	kind: z.enum(['individual', 'business'], { message: 'invoicing_kind_invalid' }),
	legalName: z.string().trim().min(1, { message: 'invoicing_legal_name_required' }).max(200),
	taxId: z.string().refine((value) => isValidEsTaxId(value) || isValidVatFormat(value), {
		message: 'invoicing_tax_id_invalid'
	}),
	address: z.string().trim().min(1, { message: 'invoicing_address_required' }).max(300),
	postalCode: z.string().trim().min(1, { message: 'invoicing_postal_code_required' }).max(20),
	city: z.string().trim().min(1, { message: 'invoicing_city_required' }).max(100),
	country: z.string().regex(/^[A-Z]{2}$/, { message: 'invoicing_country_invalid' })
});
export type BillingProfile = z.infer<typeof BillingProfile>;
