// E05 · `POST /api/v1/auth/resend-verification` (contracts/api-v1.md E05; BE-FR-02 CA3; T135). Responde siempre `202` sin
// cuerpo: exista o no la cuenta, esté o no verificada. Al superar el límite por IP responde `429` con `Retry-After` (T205).
import { apiFallback, apiRoute } from '$lib/server/api/handler';
import { firstIssuePath, jsonBodyOf } from '$lib/server/api/body';
import { validationErrorResponse } from '$lib/server/api/errors';
import { requireApp } from '$lib/server/api/session';
import { getComposition } from '$lib/server/composition.cache';
import { ResendVerificationBody } from '$lib/server/features/accounts';
import { clientIpOf } from '$lib/server/web/actions';

export const POST = apiRoute(async (event) => {
	requireApp(event);
	const parsed = ResendVerificationBody.safeParse(await jsonBodyOf(event.request));
	if (!parsed.success) return validationErrorResponse(firstIssuePath(parsed.error.issues));

	await getComposition().accounts.resendVerification({
		email: parsed.data.email,
		remoteIp: clientIpOf(event.getClientAddress)
	});
	return new Response(null, { status: 202 });
});

export const fallback = apiFallback(['POST']);
