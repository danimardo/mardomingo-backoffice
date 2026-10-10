// Auditoría de accesibilidad con axe (T052; R09, 16.11). Falla con cualquier violación `serious` o `critical`.
// El contraste dentro de `[data-surface="glass"]` no se da por bueno: axe no calcula el cristal (`backdrop-filter`),
// así que cualquier resultado ahí (incompleto o aprobado) se anota como «pendiente DS-09».
import { AxeBuilder } from '@axe-core/playwright';
import type { Page, TestInfo } from '@playwright/test';
import { expect } from '@playwright/test';
import { recordUx } from './ux-emulation';

const GLASS = '[data-surface="glass"]';
const WCAG_TAGS = ['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'];
const BLOCKING = new Set(['serious', 'critical']);

export async function checkAccessibility(page: Page, testInfo: TestInfo): Promise<void> {
	const main = await new AxeBuilder({ page })
		.withTags(WCAG_TAGS)
		.disableRules(['color-contrast'])
		.analyze();
	const outsideGlass = await new AxeBuilder({ page })
		.withTags(WCAG_TAGS)
		.withRules(['color-contrast'])
		.exclude(GLASS)
		.analyze();
	const insideGlass = await new AxeBuilder({ page })
		.withTags(WCAG_TAGS)
		.withRules(['color-contrast'])
		.include(GLASS)
		.analyze();

	const blocking = [
		...main.violations,
		...outsideGlass.violations,
		...insideGlass.violations
	].filter((v) => BLOCKING.has(v.impact ?? ''));
	expect(
		blocking.map((v) => `${v.id} (${v.impact ?? '?'}): ${v.help}`),
		'violaciones serious o critical'
	).toEqual([]);

	// Cristal: solo se anota. Nunca se cuenta como aprobado.
	if (insideGlass.violations.length > 0) {
		const found = insideGlass.violations.map((v) => `${v.id} (${v.impact ?? '?'})`).join(', ');
		recordUx(testInfo, 'contraste en cristal', 'pendiente', `violaciones: ${found}`);
	}
	if (insideGlass.incomplete.length > 0 || insideGlass.passes.length > 0) {
		recordUx(
			testInfo,
			'contraste en cristal',
			'pendiente',
			`axe no lo calcula (${String(insideGlass.incomplete.length)} incompletos, ${String(insideGlass.passes.length)} aprobados por axe); DS-09`
		);
	}
}
