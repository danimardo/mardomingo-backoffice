// Clave de los límites por IP de `accounts` (C-33; BE-FR-45, BE-FR-11.4). Función pura: sin I/O ni `node:*` (regla del
// dominio). Sigue el criterio de `normalizeIP` de Better Auth con `ipv6Subnet: 64` (que no se puede importar: vive en
// `@better-auth/core`, que no es dependencia directa): una IPv4 cuenta por sí misma, una IPv4 mapeada en IPv6
// (`::ffff:a.b.c.d`) cuenta como esa IPv4, y una IPv6 cuenta por su /64, porque una conexión IPv6 suele tener un /64 entero.
import { z } from 'zod';

const IPV4 = z.ipv4();
const IPV6 = z.ipv6();

/** Grupos de 16 bits de una IPv6; los cuatro primeros son su /64. */
const GROUPS = 8;
const PREFIX_GROUPS = 4;
const ZERO_GROUP = '0000';

type ParsedIp =
	| { readonly kind: 'v4'; readonly text: string }
	| { readonly kind: 'v6'; readonly groups: readonly string[] }
	| { readonly kind: 'other'; readonly text: string };

/** Grupos hexadecimales de una IPv4 escrita al final de una IPv6 (`::ffff:192.0.2.1` → `c000`, `0201`). */
function ipv4Groups(ipv4: string): readonly string[] {
	const [a = 0, b = 0, c = 0, d = 0] = ipv4.split('.').map(Number);
	return [(a * 256 + b).toString(16), (c * 256 + d).toString(16)];
}

/** Los ocho grupos de una IPv6 válida, de cuatro cifras en minúsculas, con `::` y la IPv4 final ya desplegados. */
function expandIpv6(ip: string): readonly string[] {
	const split = (part: string): readonly string[] =>
		part === ''
			? []
			: part.split(':').flatMap((group) => (group.includes('.') ? ipv4Groups(group) : [group]));
	const [left = '', right] = ip.split('::');
	const head = split(left);
	const tail = right === undefined ? [] : split(right);
	const zeros = Array.from({ length: GROUPS - head.length - tail.length }, () => ZERO_GROUP);
	return [...head, ...zeros, ...tail].map((group) => group.toLowerCase().padStart(4, '0'));
}

function parseIp(ip: string): ParsedIp {
	const value = ip.trim();
	if (IPV4.safeParse(value).success) return { kind: 'v4', text: value };
	if (!IPV6.safeParse(value).success) return { kind: 'other', text: value.toLowerCase() };
	const groups = expandIpv6(value);
	const mapped = groups.slice(0, 5).every((group) => group === ZERO_GROUP) && groups[5] === 'ffff';
	if (mapped) {
		const octets = groups
			.slice(6)
			.flatMap((group) => [
				Number.parseInt(group.slice(0, 2), 16),
				Number.parseInt(group.slice(2), 16)
			]);
		return { kind: 'v4', text: octets.join('.') };
	}
	return { kind: 'v6', groups };
}

/**
 * Forma canónica de una IP, sin perder ningún bit: la IPv4 tal cual, la IPv4 mapeada como IPv4 y la IPv6 con sus ocho
 * grupos de cuatro cifras en minúsculas (`2001:0db8:abcd:0012:0000:0000:0000:0007`). Lo que no es una IP se deja en
 * minúsculas. Es la forma en que se guarda `user.signup_ip`: así el /64 es un prefijo de texto fijo.
 */
export function canonicalIp(ip: string): string {
	const parsed = parseIp(ip);
	return parsed.kind === 'v6' ? parsed.groups.join(':') : parsed.text;
}

/**
 * Clave de los contadores por IP: la IPv4 (o la mapeada) tal cual y, en IPv6, su /64 con el resto a cero
 * (`2001:0db8:abcd:0012:0000:0000:0000:0000`), igual que `normalizeIP` de Better Auth con `ipv6Subnet: 64`.
 */
export function rateLimitKeyOf(ip: string): string {
	const parsed = parseIp(ip);
	if (parsed.kind !== 'v6') return parsed.text;
	return [
		...parsed.groups.slice(0, PREFIX_GROUPS),
		...Array.from({ length: GROUPS - PREFIX_GROUPS }, () => ZERO_GROUP)
	].join(':');
}

/**
 * Cómo buscar en `user.signup_ip` (guardada con `canonicalIp`) las altas que comparten la clave de `ip`: una IPv4, por
 * igualdad; una IPv6, por el rango de texto de su /64 (`desde` incluido, `hasta` excluido), que aprovecha el índice.
 */
export type SignupIpMatch =
	| { readonly kind: 'exact'; readonly ip: string }
	| { readonly kind: 'range'; readonly from: string; readonly to: string };

export function signupIpMatchOf(ip: string): SignupIpMatch {
	const parsed = parseIp(ip);
	if (parsed.kind !== 'v6') return { kind: 'exact', ip: parsed.text };
	const prefix = parsed.groups.slice(0, PREFIX_GROUPS).join(':');
	// `;` es el carácter siguiente a `:`: el rango cubre justo los textos que empiezan por el prefijo y `:`.
	return { kind: 'range', from: `${prefix}:`, to: `${prefix};` };
}
