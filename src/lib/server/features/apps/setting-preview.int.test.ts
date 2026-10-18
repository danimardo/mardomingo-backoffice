// Previsualización de cambios de parámetros contra SQLite real (W38; T309): muestra el valor vigente y el nuevo, marca los valores no
// válidos y no escribe nada en la base.
import { describe, expect, it } from 'vitest';
import { creditsFixture } from '../../../../../tests/builders/credits';
import { previewSettingChange, previewText } from './setting-preview';
import { getSetting } from './service';

describe('previsualización de parámetros (T309)', () => {
	it('un valor válido muestra el vigente y el nuevo, sin escribir', () => {
		const f = creditsFixture(Date.UTC(2026, 9, 17, 9, 0, 0));
		try {
			const before = getSetting(f.deps, 'hold_ttl_seconds');
			const preview = previewSettingChange(f.deps, 'hold_ttl_seconds', 3600);

			expect(preview).toEqual({
				key: 'hold_ttl_seconds',
				before: previewText(before),
				after: '3600',
				valid: true
			});
			expect(getSetting(f.deps, 'hold_ttl_seconds')).toEqual(before);
		} finally {
			f.close();
		}
	});

	it('un valor no válido se marca y no tiene valor nuevo', () => {
		const f = creditsFixture(Date.UTC(2026, 9, 17, 9, 0, 0));
		try {
			expect(previewSettingChange(f.deps, 'hold_ttl_seconds', 'no es un número')).toMatchObject({
				valid: false,
				after: null
			});
		} finally {
			f.close();
		}
	});
});
