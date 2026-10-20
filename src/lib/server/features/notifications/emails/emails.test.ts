// Plantillas de los emails de la cuenta (T091; BE-FR-58, BE-FR-64 CA3): texto plano completo, enlace visible, pie con el
// email de soporte, `color-scheme` claro y oscuro, y escapado de todo lo que llega de fuera.
import { describe, expect, it } from 'vitest';
import { escapeHtml } from './layout';
import { verificationEmail } from './verification';
import { passwordResetEmail } from './password-reset';
import { passwordChangedEmail } from './password-changed';

const SUPPORT = 'soporte@mardomingo.com';
const LINK = 'https://cuenta.mardomingo.com/verificar?token=abc123';

describe('email de verificación', () => {
	it('el texto plano lleva el enlace visible y el soporte en el pie', () => {
		const mail = verificationEmail({ link: LINK, appName: null, supportEmail: SUPPORT });

		expect(mail.subject).toBe('Confirma tu email');
		expect(mail.text).toContain(LINK);
		expect(mail.text).toContain(SUPPORT);
		expect(mail.text).toContain('Cuenta Mardomingo');
	});

	it('el HTML declara el esquema de color claro y oscuro y muestra el enlace como texto', () => {
		const mail = verificationEmail({ link: LINK, appName: null, supportEmail: SUPPORT });

		expect(mail.html).toContain('<meta name="color-scheme" content="light dark">');
		expect(mail.html).toContain('<meta name="supported-color-schemes" content="light dark">');
		expect(mail.html).toContain(escapeHtml(LINK));
	});

	it('si el email se refiere a una app, lo dice por su nombre visible', () => {
		const mail = verificationEmail({ link: LINK, appName: 'Secretario AI', supportEmail: SUPPORT });

		expect(mail.text).toContain('Secretario AI');
	});

	it('un nombre de app con HTML se escapa: no entra código en el email', () => {
		const mail = verificationEmail({
			link: LINK,
			appName: '<script>x()</script>',
			supportEmail: SUPPORT
		});

		expect(mail.html).not.toContain('<script>');
		expect(mail.html).toContain('&lt;script&gt;');
	});
});

describe('email de recuperación', () => {
	it('lleva el enlace y no dice de qué app es', () => {
		const mail = passwordResetEmail({ link: LINK, supportEmail: SUPPORT });

		expect(mail.subject).toBe('Restablece tu contraseña');
		expect(mail.text).toContain(LINK);
		expect(mail.text).toContain('1 hora');
	});
});

describe('aviso de cambio de contraseña', () => {
	it('no lleva enlace y ofrece el soporte por si no fue el usuario', () => {
		const mail = passwordChangedEmail({ supportEmail: SUPPORT });

		expect(mail.text).not.toContain('http');
		expect(mail.text).toContain(SUPPORT);
	});
});
