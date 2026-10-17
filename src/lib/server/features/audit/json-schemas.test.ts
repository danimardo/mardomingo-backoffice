import { describe, expect, it } from 'vitest';
import { AuditSnapshot, sensitiveFields } from './json-schemas';

describe('instantáneas de auditoría (3.7)', () => {
	it('acepta los campos cambiados, incluidos valores anidados sin datos sensibles', () => {
		const snapshot = {
			status: 'active',
			email_verified: true,
			maintenance: { active: true, message: 'Mantenimiento programado' },
			user_id: 'usr_01abc'
		};
		expect(AuditSnapshot.safeParse(snapshot).success).toBe(true);
	});

	it('rechaza contraseñas, tokens y secretos en cualquier nivel', () => {
		expect(AuditSnapshot.safeParse({ password: 'x' }).success).toBe(false);
		expect(AuditSnapshot.safeParse({ session: { token: 'abc' } }).success).toBe(false);
		expect(AuditSnapshot.safeParse({ integration: { api_key: 'abc' } }).success).toBe(false);
		expect(AuditSnapshot.safeParse({ webhook: { secret: 'abc' } }).success).toBe(false);
	});

	it('rechaza un email como clave o como valor, pero no el indicador de verificación', () => {
		expect(AuditSnapshot.safeParse({ email: 'persona@ejemplo.es' }).success).toBe(false);
		expect(AuditSnapshot.safeParse({ contacto: 'persona@ejemplo.es' }).success).toBe(false);
		expect(AuditSnapshot.safeParse({ email_normalized: 'persona' }).success).toBe(false);
		expect(AuditSnapshot.safeParse({ email_verified: 1 }).success).toBe(true);
	});

	it('indica la ruta del campo sensible encontrado', () => {
		expect(sensitiveFields({ a: [{ token: 'x' }] })).toEqual(['a.0.token']);
		expect(sensitiveFields({ a: 'texto' })).toEqual([]);
	});
});
