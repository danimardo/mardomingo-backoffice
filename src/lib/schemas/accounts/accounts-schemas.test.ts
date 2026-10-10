import { describe, expect, it } from 'vitest';
import { LoginSchema } from './login';
import { RegisterSchema } from './register';
import { RequestResetSchema, ResetPasswordSchema } from './password-reset';
import { ResendSchema } from './resend';

const VALID_REGISTER = {
	email: 'juan@ejemplo.es',
	password: 'contraseña-larga',
	acceptTerms: true,
	acceptPrivacy: true,
	acceptAup: true,
	ageDeclaration: true,
	'cf-turnstile-response': 'token',
	app: 'secretario',
	versionTerms: '2026-11-01',
	versionPrivacy: '2026-11-01',
	versionAup: '2026-11-01'
};

describe('RegisterSchema (W08, BE-FR-01)', () => {
	it('acepta un registro completo', () => {
		expect(RegisterSchema.safeParse(VALID_REGISTER).success).toBe(true);
	});

	it('exige las cuatro casillas marcadas', () => {
		expect(RegisterSchema.safeParse({ ...VALID_REGISTER, acceptTerms: false }).success).toBe(false);
		expect(RegisterSchema.safeParse({ ...VALID_REGISTER, ageDeclaration: false }).success).toBe(
			false
		);
	});

	it('limita la contraseña entre 8 y 128 caracteres', () => {
		expect(RegisterSchema.safeParse({ ...VALID_REGISTER, password: 'abcdefg' }).success).toBe(
			false
		);
		expect(RegisterSchema.safeParse({ ...VALID_REGISTER, password: 'a'.repeat(128) }).success).toBe(
			true
		);
		expect(RegisterSchema.safeParse({ ...VALID_REGISTER, password: 'a'.repeat(129) }).success).toBe(
			false
		);
	});

	it('rechaza campos desconocidos', () => {
		expect(RegisterSchema.safeParse({ ...VALID_REGISTER, rol: 'admin' }).success).toBe(false);
	});
});

describe('LoginSchema (W11, BE-FR-03)', () => {
	it('acepta email y contraseña, con destino opcional', () => {
		expect(LoginSchema.safeParse({ email: 'juan@ejemplo.es', password: 'x' }).success).toBe(true);
		expect(
			LoginSchema.safeParse({ email: 'juan@ejemplo.es', password: 'x', redirectTo: '/panel' })
				.success
		).toBe(true);
	});

	it('no exige la política de contraseña al entrar, pero sí que no esté vacía', () => {
		expect(LoginSchema.safeParse({ email: 'juan@ejemplo.es', password: '' }).success).toBe(false);
	});
});

describe('recuperación de contraseña (W12, W13)', () => {
	it('pide un email válido para solicitar', () => {
		expect(RequestResetSchema.safeParse({ email: 'no-es-un-email' }).success).toBe(false);
		expect(ResendSchema.safeParse({ email: 'juan@ejemplo.es' }).success).toBe(true);
	});

	it('restablece con token y contraseña de 8 a 128', () => {
		expect(ResetPasswordSchema.safeParse({ token: 'abc', password: '12345678' }).success).toBe(
			true
		);
		expect(ResetPasswordSchema.safeParse({ token: '', password: '12345678' }).success).toBe(false);
		expect(ResetPasswordSchema.safeParse({ token: 'abc', password: '1234567' }).success).toBe(
			false
		);
	});
});
