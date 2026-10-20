// Aviso de caducidad del saldo gratuito (T330): dice cuántos días faltan, sin enlace, con soporte en el pie.
import { describe, expect, it } from 'vitest';
import { freeExpiryWarningEmail } from './free-expiry-warning';

describe('aviso de caducidad del saldo gratuito (T330)', () => {
	it('dice cuántos días faltan y ofrece el soporte, sin enlace', () => {
		const mail = freeExpiryWarningEmail({ days: 7, supportEmail: 'soporte@mardomingo.com' });

		expect(mail.subject).toBe('Tus créditos gratuitos caducan pronto');
		expect(mail.text).toContain('7 días');
		expect(mail.text).toContain('soporte@mardomingo.com');
		expect(mail.text).not.toContain('http');
	});
});
