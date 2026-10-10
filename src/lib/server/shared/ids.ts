// Generador de identificadores opacos con prefijo por entidad (data-model 1.3).
// Inyectable: en los tests se pasa una fuente de bytes fija para obtener ids deterministas.

/** Prefijos de las entidades con id propio. Supuestos de data-model 1.3, pendientes de confirmar. */
export const ID_PREFIXES = {
	app: 'app_',
	aop: 'aop_',
	tpl: 'tpl_',
	ldoc: 'ldoc_',
	tac: 'tac_',
	fx: 'fx_',
	bkt: 'bkt_',
	hld: 'hld_',
	mov: 'mov_',
	inv: 'inv_',
	pck: 'pck_',
	pay: 'pay_',
	op: 'op_',
	ann: 'ann_',
	aud: 'aud_'
} as const;

export type IdKind = keyof typeof ID_PREFIXES;

// 32 caracteres sin los ambiguos (0, o, 1, l, i): 5 bits por carácter.
const ALPHABET = '23456789abcdefghijkmnpqrstuvwxyz';
const BODY_LENGTH = 20; // 20 × 5 bits = 100 bits
const BODY_BYTES = 13; // 104 bits: basta para 100 bits

export type RandomBytes = (length: number) => Uint8Array;

const cryptoBytes: RandomBytes = (length) => crypto.getRandomValues(new Uint8Array(length));

function encode(bytes: Uint8Array): string {
	let body = '';
	let buffer = 0;
	let bits = 0;
	for (const byte of bytes) {
		buffer = ((buffer << 8) | byte) & 0xffff;
		bits += 8;
		while (bits >= 5) {
			bits -= 5;
			body += ALPHABET.charAt((buffer >> bits) & 31);
		}
	}
	return body;
}

/** Crea un generador. Por defecto usa la fuente criptográfica del proceso. */
export function createIdGenerator(randomBytes: RandomBytes = cryptoBytes) {
	return (kind: IdKind): string => {
		const body = encode(randomBytes(BODY_BYTES)).slice(0, BODY_LENGTH);
		return `${ID_PREFIXES[kind]}${body}`;
	};
}
