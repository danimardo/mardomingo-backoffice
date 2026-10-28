// Detalle de conflictos de un rechazo por bajar un global (D07 = R02): solo cuentan las entradas con la forma completa.
import { describe, expect, it } from 'vitest';
import { ceilingConflictsOf, type CeilingConflict } from './config';

const VALID: CeilingConflict = {
	appId: 'app_1',
	appSlug: 'secretario',
	appName: 'Secretario AI',
	key: 'max_text_chars',
	override: 150_000,
	global: 100_000
};

describe('ceilingConflictsOf (D07 = R02)', () => {
	it('sin lista de conflictos devuelve una lista vacía', () => {
		expect(ceilingConflictsOf({})).toEqual([]);
		expect(ceilingConflictsOf({ field: 'value' })).toEqual([]);
		expect(ceilingConflictsOf({ conflicts: 'no es lista' })).toEqual([]);
	});

	it('devuelve las entradas completas y descarta las que no tienen su forma', () => {
		const incomplete = { appId: 'app_2', appSlug: 'otra' };
		const wrongType = { ...VALID, override: '150000' };
		expect(ceilingConflictsOf({ conflicts: [VALID, incomplete, null, wrongType] })).toEqual([
			VALID
		]);
	});
});
