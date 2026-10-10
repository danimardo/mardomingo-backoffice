// Normalización del email (BE-FR-11 CA1, BE-FR-11.5). Función pura: sin I/O ni `node:*` (regla del dominio).
// Sirve para dos cosas: el saldo de bienvenida (no se regala dos veces a la misma persona con varias direcciones)
// y el contador de intentos fallidos (que no revela si una cuenta existe). La cuenta conserva el email tal cual.

const GMAIL_DOMAINS: readonly string[] = Object.freeze(['gmail.com', 'googlemail.com']);

/** Forma normalizada de un email: minúsculas, sin `+etiqueta` y, en gmail, sin puntos y con `gmail.com`. */
export function normalizeEmail(input: string): string {
	const email = input.trim().toLowerCase();
	const at = email.lastIndexOf('@');
	if (at <= 0) return email;

	const domain = email.slice(at + 1);
	const local = email.slice(0, at);
	const plus = local.indexOf('+');
	const name = plus === -1 ? local : local.slice(0, plus);

	if (GMAIL_DOMAINS.includes(domain)) return `${name.replaceAll('.', '')}@gmail.com`;
	return `${name}@${domain}`;
}
