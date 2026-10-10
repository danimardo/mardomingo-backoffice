// Hooks del navegador (contracts/log-events.md 2.4; constitución, principio XI). Los errores no capturados y las
// promesas rechazadas se registran en la consola y se envían a `/client-errors` sin mensaje. Los errores de
// navegación de SvelteKit pasan por `handleError`.
import type { HandleClientError } from '@sveltejs/kit';
import { page } from '$app/state';
import * as m from '$lib/paraglide/messages.js';
import { applyZodMessages } from '$lib/schemas/common/zod-config';
import {
	describeError,
	emitClientEvent,
	fingerprintOf,
	sendClientErrorReport
} from '$lib/logging/client';
import type { ClientLogEventCode } from '$lib/logging/events';
import { APP_VERSION } from '$lib/version';

// Mensajes de validación en español también en el navegador (principio XII).
applyZodMessages();

// Excepción documentada de estado de módulo, solo en el cliente (la regla de la constitución es para el servidor):
// cuenta las veces que se ha visto cada huella en esta pestaña; viaja como `count` en el informe.
const seen = new Map<string, number>();

function report(event: Exclude<ClientLogEventCode, 'client.report.failed'>, error: unknown): void {
	const { name, frames } = describeError(error);
	const fingerprint = fingerprintOf(name, frames);
	const count = (seen.get(fingerprint) ?? 0) + 1;
	seen.set(fingerprint, count);

	const routeId = page.route.id ?? '';
	emitClientEvent(event, {
		route: routeId,
		version: APP_VERSION,
		err: { type: name, code: fingerprint, stack: frames.join('\n') }
	});
	sendClientErrorReport({
		name,
		fingerprint,
		frames,
		...(routeId === '' ? {} : { routeId }),
		version: APP_VERSION,
		count
	});
}

export const handleError: HandleClientError = ({ error, status }) => {
	if (status >= 500) report('client.error.uncaught', error);
	return {
		message: status === 404 ? m.errors_not_found() : m.errors_unexpected(),
		requestId: ''
	};
};

window.addEventListener('error', (event) => {
	report('client.error.uncaught', event.error);
});

window.addEventListener('unhandledrejection', (event) => {
	report('client.error.unhandled_rejection', event.reason);
});
