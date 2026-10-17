// Mensajes de validación de Zod en español (constitución, principio XII; contracts/api-v1.md 1.4).
// El mensaje depende solo del tipo de error: nunca se devuelve el valor recibido (`iss.input`).
import * as z from 'zod';
import * as m from '$lib/paraglide/messages.js';

export interface FormIssueLike {
	readonly code: string;
}

/** Texto para un problema de validación. Una entrada ausente es «obligatorio»; el resto, «no válido». */
export function formMessage(issue: FormIssueLike): string {
	return issue.code === 'invalid_type' ? m.validation_required() : m.validation_invalid();
}

/**
 * Aplica los mensajes en español a todos los esquemas. Idempotente. `jitless` evita `new Function` en la validación:
 * sin él, Firefox bloquea el `eval` por la CSP (`script-src` sin `unsafe-eval`) en el navegador.
 */
export function applyZodMessages(): void {
	z.config({ customError: (issue) => formMessage(issue), jitless: true });
}
