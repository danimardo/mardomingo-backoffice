// IP aproximada para el panel (BE-FR-49.8, D-19; T251): la IP completa nunca se muestra; IPv4 queda en su /24 y IPv6 en su /48.
import { describe, expect, it } from 'vitest';
import { approximateIp } from './approx-ip';

describe('approximateIp', () => {
	it('IPv4 se queda con el /24 y el último octeto va como x', () => {
		expect(approximateIp('203.0.113.42')).toBe('203.0.113.x');
	});

	it('IPv6 se queda con el /48 y nunca muestra el resto', () => {
		expect(approximateIp('2001:db8:abcd:1234:5678:9abc:def0:1111')).toBe('2001:db8:abcd::/48');
	});

	it('IPv6 comprimida se expande antes de cortar', () => {
		expect(approximateIp('2001:db8::1')).toBe('2001:db8:0::/48');
	});

	it('una dirección que no es IP no devuelve nada', () => {
		expect(approximateIp('no-es-una-ip')).toBeNull();
		expect(approximateIp('300.1.1.1')).toBeNull();
	});

	it('un octeto fuera de rango no es IPv4', () => {
		expect(approximateIp('10.0.0.256')).toBeNull();
	});

	it('IPv6 con el “::” al principio o al final se expande bien', () => {
		expect(approximateIp('::1')).toBe('0:0:0::/48');
		expect(approximateIp('2001:db8::')).toBe('2001:db8:0::/48');
	});

	it('IPv6 sin “::” debe tener ocho grupos', () => {
		expect(approximateIp('2001:db8:1:2:3:4:5')).toBeNull();
	});

	it('IPv6 con más de un “::” o con grupos que no son hexadecimales no sirve', () => {
		expect(approximateIp('2001::db8::1')).toBeNull();
		expect(approximateIp('2001:db8:zzzz::1')).toBeNull();
		expect(approximateIp('1:2:3:4:5:6:7:8:9::')).toBeNull();
	});
});
