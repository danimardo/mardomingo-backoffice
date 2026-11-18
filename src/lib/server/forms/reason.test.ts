// C-55: el rechazo del motivo en las acciones web (400 con el error, lo escrito y el formulario que falló).
import { describe, expect, it } from 'vitest';
import { reasonRejection } from './reason';

describe('reasonRejection', () => {
	it('un motivo válido no rechaza nada', () => {
		expect(reasonRejection('Revisión mensual')).toBeNull();
		expect(reasonRejection(`  ${'m'.repeat(500)}  `)).toBeNull();
	});

	it('un motivo vacío responde 400 con el campo obligatorio y sin formulario', () => {
		const rejected = reasonRejection('   ');

		expect(rejected?.status).toBe(400);
		expect(rejected?.data).toEqual({
			errors: { motivo: 'validation_required' },
			values: { motivo: '   ' },
			scope: null
		});
	});

	it('un motivo de más de 500 caracteres conserva lo escrito, los demás valores, el formulario y los datos extra', () => {
		const long = 'm'.repeat(501);

		const rejected = reasonRejection(long, {
			scope: 'guardarLimites:login_max_failures',
			values: { valor: '5' },
			extra: { maintenancePreview: { active: true } }
		});

		expect(rejected?.status).toBe(400);
		expect(rejected?.data).toEqual({
			maintenancePreview: { active: true },
			errors: { motivo: 'reason_too_long' },
			values: { valor: '5', motivo: long },
			scope: 'guardarLimites:login_max_failures'
		});
	});
});
