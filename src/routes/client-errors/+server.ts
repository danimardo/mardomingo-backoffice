// W52 · `POST /client-errors` (contracts/web-routes.md; contracts/log-events.md 2.4). Siempre `204`: nunca
// revela si el informe se aceptó ni devuelve datos al navegador. Un informe válido y dentro de límite se
// registra como `client.error.reported` (warn). Superado el límite, se descarta sin registrar nada.
import type { RequestHandler } from '@sveltejs/kit';
import { clientErrorReportSchema, CLIENT_ERROR_MAX_BYTES } from '$lib/schemas/client-error-report';
import { getComposition } from '$lib/server/composition.cache';
import { admitClientErrorReport } from '$lib/server/logging/client-errors.cache';
import { clientIpOf } from '$lib/server/web/actions';

const noContent = () => new Response(null, { status: 204 });

export const POST: RequestHandler = async ({ request, locals, getClientAddress }) => {
	const body = await request.text();
	if (new TextEncoder().encode(body).byteLength > CLIENT_ERROR_MAX_BYTES) return noContent();

	const parsed = parseJson(body);
	if (parsed === undefined) return noContent();
	const report = clientErrorReportSchema.safeParse(parsed);
	if (!report.success) return noContent();

	const now = getComposition().clock.now();
	// Sin IP conocida (falta la cabecera del proxy) los informes comparten un cubo: nunca dan error (T208).
	if (!admitClientErrorReport(clientIpOf(getClientAddress) ?? 'sin-ip', now)) return noContent();

	const { name, fingerprint, frames, routeId, version, count } = report.data;
	locals.log.emit('client.error.reported', {
		route: routeId ?? '',
		version,
		count,
		err: { type: name, code: fingerprint, stack: frames.join('\n') }
	});
	return noContent();
};

function parseJson(text: string): unknown {
	try {
		return JSON.parse(text);
	} catch {
		return undefined;
	}
}
