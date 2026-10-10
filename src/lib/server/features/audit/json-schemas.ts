// Instantáneas de la auditoría (data-model.md 3.7): `before` y `after` guardan solo los campos cambiados, y nunca
// contraseñas, tokens, secretos ni emails. Los usuarios se identifican por `id`, no por email.
import { z } from 'zod';

// Claves cuyo contenido nunca se audita. `email_verified` sí se puede auditar (es un booleano, no un email).
const SENSITIVE_KEY = /password|token|secret|api_?key|^email$|email_normalized/i;
const EMAIL_VALUE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Rutas («a.b.0») de los campos sensibles que aparecen en un valor, en cualquier nivel de anidamiento. */
export function sensitiveFields(value: unknown, path: readonly string[] = []): string[] {
	if (Array.isArray(value)) {
		return value.flatMap((item, index) => sensitiveFields(item, [...path, String(index)]));
	}
	if (typeof value === 'string') {
		return EMAIL_VALUE.test(value) ? [path.join('.')] : [];
	}
	if (typeof value === 'object' && value !== null) {
		return Object.entries(value).flatMap(([key, child]) => [
			...(SENSITIVE_KEY.test(key) ? [[...path, key].join('.')] : []),
			...sensitiveFields(child, [...path, key])
		]);
	}
	return [];
}

export const AuditSnapshot = z
	.record(z.string().min(1), z.unknown())
	.superRefine((snapshot, ctx) => {
		for (const field of sensitiveFields(snapshot)) {
			ctx.addIssue({
				code: 'custom',
				message: `campo sensible no admitido en la auditoría: ${field}`
			});
		}
	});
export type AuditSnapshot = z.infer<typeof AuditSnapshot>;
