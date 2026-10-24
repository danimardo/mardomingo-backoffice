// Perfil de facturación (BE-FR-74; T229): estructura estricta y datos fiscales válidos.
import { describe, expect, it } from 'vitest';
import { BillingProfile } from './billing-profile';

const VALID = {
	kind: 'individual',
	legalName: 'Ana Pérez',
	taxId: '12345678Z',
	address: 'Calle Mayor 1',
	postalCode: '28001',
	city: 'Madrid',
	country: 'ES'
};

describe('BillingProfile', () => {
	it('acepta un perfil completo y válido', () => {
		expect(BillingProfile.safeParse(VALID).success).toBe(true);
	});

	it('rechaza un campo que no está en el esquema', () => {
		expect(BillingProfile.safeParse({ ...VALID, iban: 'ES00' }).success).toBe(false);
	});

	it('[BE-FR-74/CA2] rechaza un identificador fiscal con control incorrecto', () => {
		const result = BillingProfile.safeParse({ ...VALID, taxId: '12345678A' });
		expect(result.success).toBe(false);
		expect(result.error?.issues[0]?.message).toBe('invoicing_tax_id_invalid');
	});

	it('el país debe ser de dos letras mayúsculas', () => {
		expect(BillingProfile.safeParse({ ...VALID, country: 'es' }).success).toBe(false);
		expect(BillingProfile.safeParse({ ...VALID, country: 'ESP' }).success).toBe(false);
	});

	it('el tipo debe ser individual o business', () => {
		expect(BillingProfile.safeParse({ ...VALID, kind: 'company' }).success).toBe(false);
	});
});
