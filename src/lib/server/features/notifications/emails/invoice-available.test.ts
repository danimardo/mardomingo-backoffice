// «Factura disponible» (T328): la plantilla existe, dice dónde está la factura y no lleva enlace.
import { describe, expect, it } from 'vitest';
import { invoiceAvailableEmail } from './invoice-available';

describe('aviso «Factura disponible» (T328)', () => {
	it('dice dónde está la factura, sin enlace, con soporte en el pie', () => {
		const mail = invoiceAvailableEmail({ supportEmail: 'soporte@mardomingo.com' });

		expect(mail.subject).toBe('Tu factura ya está disponible');
		expect(mail.text).toContain('panel');
		expect(mail.text).toContain('soporte@mardomingo.com');
		expect(mail.text).not.toContain('http');
	});
});
