// Rangos de los parámetros de protección al escribirlos desde administración (D08 = R03 de la propuesta de administración).
// Solo el camino de escritura los exige: la lectura de la BD sigue aceptando lo que ya está guardado.
import { describe, expect, it } from 'vitest';
import { parseAdminSettingValue, parseSettingValue, type SettingKey } from './json-schemas';

const RANGES: readonly (readonly [SettingKey, number, number])[] = [
	['global_daily_free_cost_brake_eur', 100, 10_000],
	['registrations_per_ip_24h', 1, 20],
	['login_max_failures', 3, 50],
	['login_lock_minutes', 1, 1440],
	['login_per_ip_15min', 5, 500],
	['resend_verification_per_ip_hour', 1, 50],
	['password_reset_per_ip_hour', 1, 50],
	['ai_requests_per_minute', 1, 300],
	['max_concurrent_transcriptions', 1, 10]
];

describe.each(RANGES)('rango de administración de %s (D08)', (key, min, max) => {
	it('acepta los dos extremos del rango', () => {
		expect(parseAdminSettingValue(key, min).success).toBe(true);
		expect(parseAdminSettingValue(key, max).success).toBe(true);
	});

	it('rechaza un valor un paso por debajo del mínimo y uno por encima del máximo', () => {
		expect(parseAdminSettingValue(key, min - 1).success).toBe(false);
		expect(parseAdminSettingValue(key, max + 1).success).toBe(false);
	});
});

describe('parseAdminSettingValue (D08)', () => {
	it('sigue exigiendo entero: decimales y texto no entran', () => {
		expect(parseAdminSettingValue('login_max_failures', 3.5).success).toBe(false);
		expect(parseAdminSettingValue('login_max_failures', '5').success).toBe(false);
	});

	it('no cambia los parámetros que no tienen rango de administración', () => {
		expect(parseAdminSettingValue('max_text_chars', 1_000_000_000).success).toBe(true);
	});
});

describe('lectura de la BD (D08)', () => {
	it('un valor guardado fuera del rango sigue siendo legible: la siembra de pruebas E2E puede subir registrations_per_ip_24h', () => {
		expect(parseSettingValue('registrations_per_ip_24h', 1000).success).toBe(true);
	});
});
