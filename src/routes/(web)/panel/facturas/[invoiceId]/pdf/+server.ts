// W31 · `/panel/facturas/[invoiceId]/pdf` (contracts/web-routes.md W31; BE-FR-49.10, BE-FR-75; T268). Solo descarga facturas de la
// propia cuenta: una factura ajena o inexistente responde `404`, igual que una que no existe. El PDF sale del adaptador de
// facturación; con el proveedor `none` (v4) no hay PDF y responde `404`. El proveedor `fake` (solo pruebas) entrega un PDF de prueba.
import { redirect } from '@sveltejs/kit';
import { resolve } from '$app/paths';
import { getComposition } from '$lib/server/composition.cache';
import { accessFor } from '$lib/server/features/accounts';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = ({ locals, params }) => {
	const access = accessFor(locals.user, 'verified');
	if (access.kind !== 'allow') {
		const login = resolve('/login');
		redirect(303, login);
	}
	const composition = getComposition();
	const paymentIds = composition.payments.paymentIdsOf(access.user.id);
	const pdf = composition.invoicing.pdfOf(paymentIds, params.invoiceId);
	if (pdf === undefined) return new Response(null, { status: 404 });
	return new Response(pdf, {
		status: 200,
		headers: {
			'content-type': 'application/pdf',
			'content-disposition': `attachment; filename="factura-${params.invoiceId}.pdf"`,
			'cache-control': 'private, no-store'
		}
	});
};
