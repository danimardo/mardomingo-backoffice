// Emulación de apariencia y registro del estado de cada comprobación de UX (T051; R09, 16.11).
// Cada comprobación queda como `comprobado`, `pendiente`, `no verificable` o `no aplica`, con su motivo, en
// `test-results/ux-status.jsonl`. Así el informe distingue lo medido de lo que no se pudo medir.
import { appendFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import type { Page, TestInfo } from '@playwright/test';

export type UxState = 'comprobado' | 'pendiente' | 'no verificable' | 'no aplica';

export const UX_STATUS_FILE = join('test-results', 'ux-status.jsonl');

export interface UxRecord {
	readonly check: string;
	readonly state: UxState;
	readonly reason: string;
	readonly test: string;
	readonly project: string;
}

export function recordUx(testInfo: TestInfo, check: string, state: UxState, reason = ''): void {
	const record: UxRecord = {
		check,
		state,
		reason,
		test: testInfo.title,
		project: testInfo.project.name
	};
	mkdirSync(dirname(UX_STATUS_FILE), { recursive: true });
	appendFileSync(UX_STATUS_FILE, `${JSON.stringify(record)}\n`);
}

export interface Emulation {
	readonly colorScheme?: 'light' | 'dark';
	readonly reducedMotion?: 'reduce' | 'no-preference';
	readonly forcedColors?: 'active' | 'none';
	readonly contrast?: 'more' | 'no-preference';
}

/** Emula el sistema con `page.emulateMedia`. */
export async function emulate(page: Page, emulation: Emulation): Promise<void> {
	await page.emulateMedia(emulation);
}

/**
 * `prefers-reduced-transparency` no está en `emulateMedia`: se pide por el protocolo de Chromium y se comprueba
 * con `matchMedia`. Si el navegador no lo aplica, o no es Chromium, la comprobación es «no verificable».
 */
export async function emulateReducedTransparency(page: Page, testInfo: TestInfo): Promise<boolean> {
	if (testInfo.project.name !== 'chromium') {
		recordUx(testInfo, 'prefers-reduced-transparency', 'no verificable', 'solo Chromium por CDP');
		return false;
	}
	const session = await page.context().newCDPSession(page);
	await session.send('Emulation.setEmulatedMedia', {
		features: [{ name: 'prefers-reduced-transparency', value: 'reduce' }]
	});
	const applied = await page.evaluate(
		() => window.matchMedia('(prefers-reduced-transparency: reduce)').matches
	);
	if (!applied) {
		recordUx(
			testInfo,
			'prefers-reduced-transparency',
			'no verificable',
			'el navegador no lo aplica por CDP'
		);
	}
	return applied;
}
