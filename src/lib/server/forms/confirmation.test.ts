// Patrón de confirmación (T302; UX-13): solo `confirmado=true` aplica, y el enlace tras aplicar lleva el aviso y la entrada.
import { describe, expect, it } from 'vitest';
import { CONFIRM_FIELD, isConfirmed, savedRedirect } from './confirmation';

function form(entries: Record<string, string>): FormData {
	const data = new FormData();
	for (const [key, value] of Object.entries(entries)) data.set(key, value);
	return data;
}

describe('patrón de confirmación', () => {
	it('sin confirmado es vista previa: no aplica', () => {
		expect(isConfirmed(form({ motivo: 'corrección' }))).toBe(false);
	});

	it('solo confirmado=true aplica; otros valores no', () => {
		expect(CONFIRM_FIELD).toBe('confirmado');
		expect(isConfirmed(form({ [CONFIRM_FIELD]: 'true' }))).toBe(true);
		expect(isConfirmed(form({ [CONFIRM_FIELD]: 'on' }))).toBe(false);
		expect(isConfirmed(form({ [CONFIRM_FIELD]: '' }))).toBe(false);
	});

	it('el enlace tras aplicar lleva el aviso y la entrada de auditoría', () => {
		expect(savedRedirect('/admin/usuarios', 'aud_123')).toBe(
			'/admin/usuarios?aviso=saved&auditoria=aud_123'
		);
	});

	it('el id de la entrada se codifica en la URL', () => {
		expect(savedRedirect('/admin', 'a&b=c')).toBe('/admin?aviso=saved&auditoria=a%26b%3Dc');
	});
});
