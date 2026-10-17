// Declaración de las 19 tablas de L02 (T069–T074; data-model.md 2.x). Leer la configuración de cada tabla ejecuta sus
// restricciones (`CHECK`, índices, únicos) tal como están declaradas, así que este test también las cubre. Las
// migraciones reales se comprueban en `migrations.int.test.ts` y en las pruebas de integración de cada funcionalidad.
import { getTableConfig, type SQLiteTable } from 'drizzle-orm/sqlite-core';
import { describe, expect, it } from 'vitest';
import {
	account,
	authRateLimits,
	disposableDomains,
	loginAttempts,
	session,
	user,
	userAppActivity,
	verification
} from '$lib/server/features/accounts/schema';
import { adminAudit } from '$lib/server/features/audit/schema';
import { apps, appOperations, promptTemplates, settings } from '$lib/server/features/apps/schema';
import { legalDocuments, termsAcceptances } from '$lib/server/features/legal/schema';
import { fxRates } from '$lib/server/features/pricing/schema';
import { packs, payments } from '$lib/server/features/payments/schema';
import { aiOperations } from '$lib/server/features/ai/schema';

const TABLES: readonly SQLiteTable[] = [
	user,
	session,
	account,
	verification,
	authRateLimits,
	loginAttempts,
	disposableDomains,
	userAppActivity,
	adminAudit,
	apps,
	appOperations,
	promptTemplates,
	settings,
	legalDocuments,
	termsAcceptances,
	fxRates,
	packs,
	payments,
	aiOperations
];

function checkNames(table: SQLiteTable): string[] {
	return getTableConfig(table).checks.map((check) => check.name);
}

function indexNames(table: SQLiteTable): string[] {
	return getTableConfig(table).indexes.map((index) => index.config.name);
}

describe('declaración de las tablas de L02', () => {
	it('las 19 tablas tienen su nombre en la base de datos', () => {
		expect(TABLES.map((table) => getTableConfig(table).name)).toEqual([
			'user',
			'session',
			'account',
			'verification',
			'auth_rate_limits',
			'login_attempts',
			'disposable_domains',
			'user_app_activity',
			'admin_audit',
			'apps',
			'app_operations',
			'prompt_templates',
			'settings',
			'legal_documents',
			'terms_acceptances',
			'fx_rates',
			'packs',
			'payments',
			'ai_operations'
		]);
	});

	it('las restricciones CHECK de cada tabla están declaradas', () => {
		expect(checkNames(user)).toEqual(
			expect.arrayContaining(['user_role_not_empty', 'user_banned_bool'])
		);
		expect(checkNames(apps)).toEqual(
			expect.arrayContaining(['apps_slug_format', 'apps_enforce_version_needs_min'])
		);
		expect(checkNames(appOperations)).toEqual(
			expect.arrayContaining(['app_operations_margin_min', 'app_operations_active_needs_model'])
		);
		expect(checkNames(promptTemplates)).toContain('prompt_templates_version_min');
		expect(checkNames(termsAcceptances)).toContain('terms_acceptances_document_enum');
		expect(checkNames(fxRates)).toEqual(
			expect.arrayContaining(['fx_rates_ecb_fields', 'fx_rates_manual_has_author'])
		);
		expect(checkNames(payments)).toEqual(
			expect.arrayContaining(['payments_vat_adds_up', 'payments_simulated_matches_provider'])
		);
		expect(checkNames(aiOperations)).toEqual(
			expect.arrayContaining([
				'ai_operations_unbilled_statuses',
				'ai_operations_rejected_has_no_hold_or_provider'
			])
		);
		expect(checkNames(adminAudit)).toEqual(
			expect.arrayContaining(['admin_audit_before_json', 'admin_audit_after_json'])
		);
	});

	it('los índices únicos y parciales están declarados con su nombre', () => {
		expect(indexNames(user)).toEqual(expect.arrayContaining(['one_admin', 'user_inactivity_idx']));
		expect(indexNames(termsAcceptances)).toContain(
			'terms_acceptances_user_document_version_unique'
		);
		expect(indexNames(aiOperations)).toEqual(
			expect.arrayContaining([
				'ai_operations_inflight_idempotency_unique',
				'ai_operations_flagged_idx'
			])
		);
		expect(indexNames(payments)).toContain('payments_user_attempt_unique');
		expect(indexNames(packs)).toContain('packs_active_order_idx');
		expect(indexNames(settings)).toEqual([]);
	});
});
