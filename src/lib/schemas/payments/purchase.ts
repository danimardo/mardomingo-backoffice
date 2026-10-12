// Formulario de compra de créditos (W20; BE-FR-25 CA4, BE-FR-26, BE-FR-74). La casilla de renuncia nunca va premarcada: debe
// llegar `true`. Con factura completa, los datos fiscales son obligatorios y se validan con el mismo esquema que el perfil.
import * as z from 'zod';
import { BillingProfile } from '$lib/schemas/invoicing/billing-profile';

const optionalText = z.string().optional();

export const PurchaseForm = z
	.object({
		packId: z.string().min(1),
		intentId: z.uuid(),
		waiverAccepted: z.literal(true),
		waiverVersion: z.string().min(1),
		wantsFullInvoice: z.boolean(),
		billingKind: z.enum(['individual', 'business']).optional(),
		legalName: optionalText,
		taxId: optionalText,
		address: optionalText,
		postalCode: optionalText,
		city: optionalText,
		country: optionalText
	})
	.superRefine((value, ctx) => {
		if (!value.wantsFullInvoice) return;
		const result = BillingProfile.safeParse({
			kind: value.billingKind,
			legalName: value.legalName,
			taxId: value.taxId,
			address: value.address,
			postalCode: value.postalCode,
			city: value.city,
			country: value.country
		});
		if (result.success) return;
		for (const issue of result.error.issues) {
			ctx.addIssue({
				code: 'custom',
				path: [String(issue.path[0] ?? 'taxId')],
				message: issue.message
			});
		}
	});

export type PurchaseFormData = z.output<typeof PurchaseForm>;

/** Datos fiscales de la compra, en la forma del perfil (solo si pide factura completa). */
export function billingOf(data: PurchaseFormData) {
	return {
		kind: data.billingKind,
		legalName: data.legalName,
		taxId: data.taxId,
		address: data.address,
		postalCode: data.postalCode,
		city: data.city,
		country: data.country
	};
}
