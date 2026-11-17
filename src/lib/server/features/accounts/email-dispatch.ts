// Envío de los emails de cuenta sin esperar su resultado (C-17; BE-FR-01 CA5, BE-FR-66 CA3). Esperar al proveedor en el camino
// de la respuesta revela por el tiempo si la cuenta (o la dirección) existe: solo se envía cuando existe. El envío se lanza
// aquí, en un único sitio: nada del flujo depende de su resultado, un fallo se registra sin datos personales y el servicio
// guarda las promesas en curso para que las pruebas (`drainEmails`) esperen a que terminen.
import type { Logger } from '$lib/server/logging/logger';

export interface EmailDispatcher {
	/** Lanza el envío sin esperarlo. Un fallo (excepción) se registra y no llega a quien llama. */
	dispatch(send: () => Promise<unknown>): void;
	/** Espera a los envíos en curso. Solo lo usan las pruebas. */
	drain(): Promise<void>;
}

/** Arranca el envío en el acto (no en otro turno) y convierte también una excepción síncrona en un rechazo. */
function started(send: () => Promise<unknown>): Promise<unknown> {
	try {
		return send();
	} catch (error) {
		return Promise.reject(error instanceof Error ? error : new Error(String(error)));
	}
}

export function createEmailDispatcher(logger: Logger): EmailDispatcher {
	const pending = new Set<Promise<void>>();
	return {
		dispatch(send) {
			const task: Promise<void> = started(send)
				.then(
					() => undefined,
					(err: unknown) => {
						// Un rechazo del proveedor (`false`) ya lo registra `notifications`; esto es una excepción (red, plantilla).
						logger.emit('accounts.email.dispatch_failed', { err });
					}
				)
				.finally(() => {
					pending.delete(task);
				});
			pending.add(task);
		},
		async drain() {
			while (pending.size > 0) await Promise.all([...pending]);
		}
	};
}
