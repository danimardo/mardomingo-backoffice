// IP aproximada para mostrar en el panel (BE-FR-49.8, D-19; T251). La IP completa nunca sale: IPv4 queda en su /24 (`x`
// en el último octeto) e IPv6 en su /48. Una dirección que no es IP no devuelve nada.

const IPV4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;
const HEX_GROUP = /^[0-9a-fA-F]{1,4}$/;

export function approximateIp(ip: string): string | null {
	const v4 = IPV4.exec(ip);
	if (v4 !== null) {
		const octets = v4.slice(1, 4).map(Number);
		if (v4.slice(1).some((octet) => Number(octet) > 255)) return null;
		return `${octets.join('.')}.x`;
	}
	return ip.includes(':') ? approximateIpv6(ip) : null;
}

function approximateIpv6(ip: string): string | null {
	const halves = ip.split('::');
	if (halves.length > 2) return null;
	const head = halves[0] === undefined || halves[0] === '' ? [] : halves[0].split(':');
	const tail =
		halves.length === 2 && halves[1] !== '' && halves[1] !== undefined ? halves[1].split(':') : [];
	const compressed = halves.length === 2;
	const zeros = compressed ? 8 - head.length - tail.length : 0;
	if (compressed ? zeros < 1 : head.length !== 8) return null;
	const groups = [...head, ...Array.from({ length: zeros }, () => '0'), ...tail];
	if (groups.length !== 8 || !groups.every((group) => HEX_GROUP.test(group))) return null;
	const prefix = groups.slice(0, 3).map((group) => parseInt(group, 16).toString(16));
	return `${prefix.join(':')}::/48`;
}
