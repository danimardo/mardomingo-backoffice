// Presentador de sesiones del panel (T258; BE-FR-49.2–49.4): claves exactas, sin token ni agente de usuario, con la IP
// aproximada y la marca de la sesión actual.
import { describe, expect, it } from 'vitest';
import { civilDateOf } from '$lib/shared/dates';
import { toEpochMs } from '$lib/shared/time';
import { sessionDtoOf } from './presenters';
import type { SessionView } from './sessions';

const item: SessionView = {
	id: 'ses_actual',
	createdAt: toEpochMs(1_700_000_000_000),
	lastUsedAt: toEpochMs(1_700_003_600_000),
	deviceName: 'PC-PRUEBA',
	approxIp: '203.0.113.0/24',
	userAgent: 'Mozilla/5.0 (secreto)'
};

describe('presentador de sesiones (BE-FR-49.2–49.4)', () => {
	it('expone solo sus campos, con las claves exactas', () => {
		const dto = sessionDtoOf(item, 'ses_actual');

		expect(Object.keys(dto).sort()).toStrictEqual(
			['approxIp', 'createdOn', 'current', 'deviceName', 'id', 'lastUsedOn'].sort()
		);
		expect(JSON.stringify(dto)).not.toContain('secreto');
	});

	it('marca la sesión que hace la petición y no marca las demás', () => {
		expect(sessionDtoOf(item, 'ses_actual').current).toBe(true);
		expect(sessionDtoOf(item, 'otra').current).toBe(false);
		expect(sessionDtoOf(item, null).current).toBe(false);
	});

	it('sin IP aproximada ni nombre de equipo, los campos quedan vacíos y nunca nulos', () => {
		const dto = sessionDtoOf({ ...item, approxIp: null, deviceName: null, lastUsedAt: null }, null);

		expect(dto).toStrictEqual({
			id: 'ses_actual',
			current: false,
			createdOn: civilDateOf(toEpochMs(1_700_000_000_000)),
			lastUsedOn: null,
			deviceName: '',
			approxIp: ''
		});
	});
});
