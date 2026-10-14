// W31 · `/panel/facturas/[invoiceId]/pdf` (contracts/web-routes.md W31; BE-FR-49.10, BE-FR-75; T268). Solo descarga facturas de la
// propia cuenta: una factura ajena o inexistente responde `404`, igual que una que no existe. El PDF saldría del adaptador de
// facturación; con el proveedor `none` (v4) no se emite ninguna factura, así que una factura propia también responde `404`
// «no disponible». Falta el PDF real cuando haya proveedor que emita (pendiente de decisión del propietario).
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
	const owned = composition.invoicing
		.invoicesFor(paymentIds)
		.some((item) => item.id === params.invoiceId);
	if (!owned) return new Response(null, { status: 404 });
	return new Response(null, { status: 404 });
};
