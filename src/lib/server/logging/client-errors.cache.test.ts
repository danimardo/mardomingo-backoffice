import { beforeEach, describe, expect, it } from 'vitest';
import { admitClientErrorReport, resetClientErrorLimits } from './client-errors.cache';

const MINUTE = 60_000;

beforeEach(() => {
	resetClientErrorLimits();
});

describe('límite de informes del navegador', () => {
	it('admite hasta 20 informes por visitante en una ventana', () => {
		const admitted = Array.from({ length: 25 }, () => admitClientErrorReport('visitante-a', 0));

		expect(admitted.filter(Boolean)).toHaveLength(20);
	});

	it('un visitante no agota el cupo de otro', () => {
		for (let index = 0; index < 20; index += 1) admitClientErrorReport('visitante-a', 0);

		expect(admitClientErrorReport('visitante-b', 0)).toBe(true);
	});

	it('la ventana se reinicia al cumplirse el minuto', () => {
		for (let index = 0; index < 20; index += 1) admitClientErrorReport('visitante-a', 0);

		expect(admitClientErrorReport('visitante-a', MINUTE)).toBe(true);
	});

	it('el límite global corta aunque cada visitante esté dentro de su cupo', () => {
		let admitted = 0;
		for (let index = 0; index < 400; index += 1) {
			if (admitClientErrorReport(`visitante-${String(index)}`, 0)) admitted += 1;
		}

		expect(admitted).toBe(300);
	});
});
