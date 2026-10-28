// Cuenta origen de la copia de predeterminados (BE-FR-42 CA3; D03 = R13): solo la cuenta del propio administrador.
import { describe, expect, it } from 'vitest';
import { copySourceUserId } from './origen';

describe('cuenta origen de la copia de predeterminados (BE-FR-42 CA3, D03)', () => {
	it('sin parámetro o con el parámetro vacío, la fuente es la cuenta del administrador', () => {
		expect(copySourceUserId('adm_1', null)).toBe('adm_1');
		expect(copySourceUserId('adm_1', '')).toBe('adm_1');
	});

	it('pedir la propia cuenta del administrador se acepta', () => {
		expect(copySourceUserId('adm_1', 'adm_1')).toBe('adm_1');
	});

	it('cualquier otra cuenta se rechaza, exista o no', () => {
		expect(copySourceUserId('adm_1', 'usr_panel')).toBeNull();
		expect(copySourceUserId('adm_1', 'usr_inexistente')).toBeNull();
	});

	it('un identificador parecido al propio no cuenta como propio', () => {
		expect(copySourceUserId('adm_1', 'adm_10')).toBeNull();
		expect(copySourceUserId('adm_1', 'ADM_1')).toBeNull();
		expect(copySourceUserId('adm_1', ' adm_1')).toBeNull();
	});
});
