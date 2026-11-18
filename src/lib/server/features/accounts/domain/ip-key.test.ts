// Clave de los límites por IP (C-33; BE-FR-45, BE-FR-11.4): IPv4 tal cual, IPv4 mapeada como IPv4 e IPv6 por su /64, con el
// mismo resultado que `normalizeIP` de Better Auth con `ipv6Subnet: 64`.
import { describe, expect, it } from 'vitest';
import { canonicalIp, rateLimitKeyOf, signupIpMatchOf } from './ip-key';

describe('[C-33] canonicalIp', () => {
	it('deja una IPv4 tal cual', () => {
		expect(canonicalIp('203.0.113.7')).toBe('203.0.113.7');
	});

	it('convierte una IPv4 mapeada en IPv6 en esa IPv4, también escrita en hexadecimal', () => {
		expect(canonicalIp('::ffff:198.51.100.1')).toBe('198.51.100.1');
		expect(canonicalIp('::FFFF:c633:6401')).toBe('198.51.100.1');
		expect(canonicalIp('0:0:0:0:0:ffff:198.51.100.1')).toBe('198.51.100.1');
	});

	it('escribe una IPv6 con sus ocho grupos de cuatro cifras en minúsculas, sin perder ningún bit', () => {
		expect(canonicalIp('2001:DB8:abcd:12::7')).toBe('2001:0db8:abcd:0012:0000:0000:0000:0007');
		expect(canonicalIp('2001:0db8:abcd:0012:0:0:0:7')).toBe(
			'2001:0db8:abcd:0012:0000:0000:0000:0007'
		);
		expect(canonicalIp('::1')).toBe('0000:0000:0000:0000:0000:0000:0000:0001');
		expect(canonicalIp('::')).toBe('0000:0000:0000:0000:0000:0000:0000:0000');
		expect(canonicalIp('fe80::')).toBe('fe80:0000:0000:0000:0000:0000:0000:0000');
	});

	it('despliega una IPv4 escrita al final de una IPv6 que no es mapeada', () => {
		expect(canonicalIp('64:ff9b::192.0.2.1')).toBe('0064:ff9b:0000:0000:0000:0000:c000:0201');
	});

	it('deja en minúsculas lo que no es una IP', () => {
		expect(canonicalIp(' Desconocida ')).toBe('desconocida');
	});
});

describe('[C-33] rateLimitKeyOf', () => {
	it('una IPv4 es su propia clave', () => {
		expect(rateLimitKeyOf('198.51.100.9')).toBe('198.51.100.9');
	});

	it('una IPv4 mapeada tiene la clave de esa IPv4', () => {
		expect(rateLimitKeyOf('::ffff:198.51.100.9')).toBe('198.51.100.9');
	});

	it('las direcciones del mismo /64 comparten clave, con el resto a cero', () => {
		const key = '2001:0db8:abcd:0012:0000:0000:0000:0000';
		expect(rateLimitKeyOf('2001:db8:abcd:12::1')).toBe(key);
		expect(rateLimitKeyOf('2001:DB8:ABCD:12:ffff:ffff:ffff:ffff')).toBe(key);
		expect(rateLimitKeyOf('2001:db8:abcd:12::')).toBe(key);
	});

	it('otro /64 tiene otra clave', () => {
		expect(rateLimitKeyOf('2001:db8:abcd:13::1')).toBe('2001:0db8:abcd:0013:0000:0000:0000:0000');
	});
});

describe('[C-33] signupIpMatchOf', () => {
	it('una IPv4 se busca por igualdad, también si llega mapeada', () => {
		expect(signupIpMatchOf('198.51.100.1')).toEqual({ kind: 'exact', ip: '198.51.100.1' });
		expect(signupIpMatchOf('::ffff:198.51.100.1')).toEqual({ kind: 'exact', ip: '198.51.100.1' });
	});

	it('una IPv6 se busca por el rango de texto de su /64', () => {
		const match = signupIpMatchOf('2001:db8:abcd:12::7');
		expect(match).toEqual({
			kind: 'range',
			from: '2001:0db8:abcd:0012:',
			to: '2001:0db8:abcd:0012;'
		});
		if (match.kind !== 'range') return;
		const inside = canonicalIp('2001:db8:abcd:12:ffff::1');
		const outside = canonicalIp('2001:db8:abcd:13::1');
		expect(inside >= match.from && inside < match.to).toBe(true);
		expect(outside >= match.from && outside < match.to).toBe(false);
	});
});
