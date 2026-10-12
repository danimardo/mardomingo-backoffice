// Identificadores fiscales españoles (BE-FR-74 CA2; T229). Sin I/O. NIF y NIE con la letra de control; CIF con su dígito o
// letra de control. El NIF-IVA intracomunitario se valida solo por formato: la comprobación en VIES queda pendiente.

const LETTERS = 'TRWAGMYFPDXBNJZSQVHLCKE';
const CIF_CONTROL_LETTERS = 'JABCDEFGHI';
const CIF_LETTERS = 'ABCDEFGHJNPQRSUVW';

export function normalizeTaxId(value: string): string {
	return value.replace(/[\s-]/g, '').toUpperCase();
}

function nifLetterOf(digits: string): string {
	return LETTERS.charAt(Number(digits) % 23);
}

function isNif(id: string): boolean {
	return /^\d{8}[A-Z]$/.test(id) && nifLetterOf(id.slice(0, 8)) === id.charAt(8);
}

function isNie(id: string): boolean {
	if (!/^[XYZ]\d{7}[A-Z]$/.test(id)) return false;
	const prefix = { X: '0', Y: '1', Z: '2' }[id.charAt(0)] ?? '';
	return nifLetterOf(prefix + id.slice(1, 8)) === id.charAt(8);
}

function isCif(id: string): boolean {
	if (!/^[ABCDEFGHJNPQRSUVW]\d{7}[0-9A-J]$/.test(id)) return false;
	const digits = id.slice(1, 8).split('').map(Number);
	let sum = 0;
	digits.forEach((digit, index) => {
		if (index % 2 === 0) {
			const doubled = digit * 2;
			sum += doubled > 9 ? doubled - 9 : doubled;
		} else {
			sum += digit;
		}
	});
	const control = (10 - (sum % 10)) % 10;
	const first = id.charAt(0);
	const last = id.charAt(8);
	const digitControl = String(control);
	const letterControl = CIF_CONTROL_LETTERS.charAt(control);
	if ('PQRSNW'.includes(first)) return last === letterControl;
	if ('ABEH'.includes(first)) return last === digitControl;
	return last === digitControl || last === letterControl;
}

/** NIF, NIE o CIF español con su control correcto. */
export function isValidEsTaxId(value: string): boolean {
	const id = normalizeTaxId(value);
	if (!CIF_LETTERS.includes(id.charAt(0))) return isNif(id) || isNie(id);
	return isCif(id);
}

/** NIF-IVA: dos letras de país y un identificador. Para España, el documento debe ser válido; el resto, solo formato. */
export function isValidVatFormat(value: string): boolean {
	const vat = normalizeTaxId(value);
	if (!/^[A-Z]{2}[0-9A-Z]{2,12}$/.test(vat)) return false;
	if (vat.startsWith('ES')) return isValidEsTaxId(vat.slice(2));
	return true;
}
