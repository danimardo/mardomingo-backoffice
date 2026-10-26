// W35 · `/admin/usuarios/[userId]` (contracts/web-routes.md W35; BE-FR-50, BE-FR-18; T306). Ficha de la cuenta con sus acciones de
// administración: bloquear, desbloquear, marcar o desmarcar tester, y cerrar sesiones. Las acciones destructivas siguen el
// patrón de confirmación: `previsualizar` no cambia nada; la acción aplica solo con `confirmado=true`, y el motivo es obligatorio.
// Pendiente (anotado en tasks.md): saldo, reservas, bolsas, movimientos, consumo, pagos y facturas de la ficha.
import { error, fail, redirect } from '@sveltejs/kit';
import { resolve } from '$app/paths';
import { getComposition } from '$lib/server/composition.cache';
import { consumptionPage } from '$lib/server/features/ai';
import { parsePanelFilters, type DateOrder } from '$lib/schemas/common/filters';
import { addDays, madridMidnight } from '$lib/shared/dates';
import { fetchLimit, pageNumber, sliceOf } from '$lib/shared/paging';
import { toEpochMs, type EpochMs } from '$lib/shared/time';
import { bucketsForAdmin } from '$lib/server/features/credits';
import { billingProfileOf, invoicesFor } from '$lib/server/features/invoicing';
import { paymentsForAdmin } from '$lib/server/features/payments';
import {
	accessFor,
	accountView,
	blockUser,
	closeUserSessions,
	setTester,
	unblockUser
} from '$lib/server/features/accounts';
import { isConfirmed, savedRedirect } from '$lib/server/forms/confirmation';
import { failureOf } from '$lib/server/web/actions';
import { AppError } from '$lib/server/shared/errors';
import type { Actions, PageServerLoad } from './$types';

function adminOrThrow(locals: App.Locals) {
	const access = accessFor(locals.user, 'admin');
	if (access.kind === 'anonymous' || access.kind === 'blocked' || access.kind === 'unverified') {
		const login = resolve('/login');
		redirect(303, login);
	}
	if (access.kind !== 'allow') error(403);
	return access.user;
}

function reasonOf(form: FormData): string {
	const value = form.get('motivo');
	return typeof value === 'string' ? value : '';
}

/** Claves de página de cada lista en la URL (UX-09). */
const PAGE_KEYS = Object.freeze([
	'pag_bolsas',
	'pag_facturas',
	'pag_pagos',
	'pag_consumo',
	'pag_movimientos'
]);

/** Rango de fechas (días de Madrid) de los filtros de movimientos y consumo; sin rango si el filtro no es válido. */
function rangeOf(params: URLSearchParams): {
	readonly desde: string;
	readonly hasta: string;
	readonly orden: DateOrder;
	readonly fromMs: EpochMs | null;
	readonly toMs: EpochMs | null;
} {
	const parsed = parsePanelFilters(Object.fromEntries(params));
	if (!parsed.ok) return { desde: '', hasta: '', orden: 'desc', fromMs: null, toMs: null };
	const { desde, hasta, orden } = parsed.value;
	return {
		desde: desde === null ? '' : String(desde),
		hasta: hasta === null ? '' : String(hasta),
		orden,
		fromMs: desde === null ? null : madridMidnight(desde),
		toMs: hasta === null ? null : toEpochMs(madridMidnight(addDays(hasta, 1)) - 1)
	};
}

export const load: PageServerLoad = ({ locals, params, setHeaders, url }) => {
	adminOrThrow(locals);
	setHeaders({ 'cache-control': 'private, no-store' });
	const composition = getComposition();
	const account = accountView(composition.adminUsers, params.userId);
	if (account === null) error(404);
	const balance = composition.credits.getBalance(params.userId);
	// Aviso tras una acción aplicada: enlaza con su entrada de auditoría (UX-13). Solo si el id tiene forma de id.
	const auditId = url.searchParams.get('auditoria') ?? '';
	const saved =
		url.searchParams.get('aviso') === 'saved' && /^[A-Za-z0-9_-]{1,64}$/.test(auditId)
			? auditId
			: null;

	// UX-09: rango de fechas para movimientos y consumo, y una página propia por lista, todo en la URL.
	const range = rangeOf(url.searchParams);
	const page = (key: string): number => pageNumber(url.searchParams.get(key));
	const userId = params.userId;
	const movements = composition.credits.movements({
		userId,
		fromMs: range.fromMs,
		toMs: range.toMs,
		appId: null,
		page: page('pag_movimientos'),
		order: range.orden
	});
	const consumption = consumptionPage(composition.db, {
		userId,
		fromMs: range.fromMs,
		toMs: range.toMs,
		appId: null,
		page: page('pag_consumo'),
		order: range.orden
	});
	const buckets = sliceOf(
		bucketsForAdmin(composition.db, userId, fetchLimit(page('pag_bolsas'))),
		page('pag_bolsas')
	);
	const payments = sliceOf(
		paymentsForAdmin(composition.db, userId, fetchLimit(page('pag_pagos'))),
		page('pag_pagos')
	);
	const invoices = sliceOf(
		invoicesFor({ db: composition.db }, composition.payments.paymentIdsOf(userId)).map((row) => ({
			id: row.id,
			kind: row.kind,
			number: `${row.series}-${row.number}`,
			amountEurCents: row.amountEurCents,
			issuedAt: new Date(row.issuedAt).toISOString()
		})),
		page('pag_facturas')
	);

	// Parámetros que se conservan al cambiar de página: el rango y las páginas de las demás listas.
	const keep: Record<string, string> = {};
	if (range.desde !== '') keep.desde = range.desde;
	if (range.hasta !== '') keep.hasta = range.hasta;
	if (range.orden === 'asc') keep.orden = 'asc';
	for (const key of PAGE_KEYS) {
		const value = url.searchParams.get(key);
		if (value !== null && value !== '') keep[key] = value;
	}

	return {
		saved,
		account,
		filters: { desde: range.desde, hasta: range.hasta, orden: range.orden },
		keep,
		balance: {
			totalMicro: balance.totalMicro,
			availableMicro: balance.availableMicro,
			debtMicro: balance.debtMicro
		},
		movements: movements.rows.map((row) => ({
			type: row.type,
			amountMicro: row.amountMicro,
			createdAt: new Date(row.createdAt).toISOString()
		})),
		buckets: buckets.items.map((row) => ({
			kind: row.kind,
			source: row.source,
			initialMicro: row.initialMicro,
			remainingMicro: row.remainingMicro,
			expiresAt: row.expiresAt === null ? null : new Date(row.expiresAt).toISOString(),
			simulated: row.simulated,
			createdAt: new Date(row.createdAt).toISOString()
		})),
		invoices: invoices.items,
		fiscalProfile: billingProfileOf(composition.db, userId) !== undefined,
		payments: payments.items.map((row) => ({
			id: row.id,
			status: row.status,
			amountEurCents: row.amountEurCents,
			simulated: row.simulated,
			createdAt: new Date(row.createdAt).toISOString()
		})),
		consumption: consumption.rows.map((row) => ({
			appId: row.appId,
			operation: row.operation,
			status: row.status,
			chargedMicro: row.chargedMicro,
			createdAt: new Date(row.createdAt).toISOString()
		})),
		paging: {
			bolsas: buckets,
			facturas: invoices,
			pagos: payments,
			consumo: consumption.pagination,
			movimientos: movements.pagination
		}
	};
};

/** Acciones de la ficha que tienen vista previa (`?/previsualizar`). */
const PREVIEWABLE = Object.freeze(['bloquear', 'desbloquear', 'tester', 'cerrarSesiones']);

export const actions: Actions = {
	// Vista previa: dice qué cambiaría la acción y no cambia nada. La confirmación la hace el formulario de la acción real.
	previsualizar: async ({ locals, params, request }) => {
		adminOrThrow(locals);
		const form = await request.formData();
		const accion = form.get('accion');
		if (typeof accion !== 'string' || !PREVIEWABLE.includes(accion)) {
			return fail(400, { formError: 'VALIDATION_ERROR' });
		}
		const account = accountView(getComposition().adminUsers, params.userId);
		if (account === null) error(404);
		return {
			preview: {
				accion,
				subject: account.email,
				reason: reasonOf(form),
				on: form.get('on') === 'true' ? 'true' : 'false'
			}
		};
	},
	bloquear: async ({ locals, params, request }) => {
		const admin = adminOrThrow(locals);
		const form = await request.formData();
		if (!isConfirmed(form)) return fail(400, { formError: 'VALIDATION_ERROR' });
		try {
			const entryId = blockUser(getComposition().adminUsers, {
				adminId: admin.id,
				userId: params.userId,
				reason: reasonOf(form)
			});
			const target = `${resolve('/admin/usuarios')}/${encodeURIComponent(params.userId)}`;
			const next = savedRedirect(target, entryId);
			redirect(303, next);
		} catch (cause) {
			if (cause instanceof AppError) return failureOf(cause);
			throw cause;
		}
	},
	desbloquear: async ({ locals, params, request }) => {
		const admin = adminOrThrow(locals);
		const form = await request.formData();
		if (!isConfirmed(form)) return fail(400, { formError: 'VALIDATION_ERROR' });
		try {
			const entryId = unblockUser(getComposition().adminUsers, {
				adminId: admin.id,
				userId: params.userId,
				reason: reasonOf(form)
			});
			const target = `${resolve('/admin/usuarios')}/${encodeURIComponent(params.userId)}`;
			const next = entryId === null ? target : savedRedirect(target, entryId);
			redirect(303, next);
		} catch (cause) {
			if (cause instanceof AppError) return failureOf(cause);
			throw cause;
		}
	},
	tester: async ({ locals, params, request }) => {
		const admin = adminOrThrow(locals);
		const form = await request.formData();
		if (!isConfirmed(form)) return fail(400, { formError: 'VALIDATION_ERROR' });
		try {
			const entryId = setTester(getComposition().adminUsers, {
				adminId: admin.id,
				userId: params.userId,
				on: form.get('on') === 'true',
				reason: reasonOf(form)
			});
			const target = `${resolve('/admin/usuarios')}/${encodeURIComponent(params.userId)}`;
			const next = entryId === null ? target : savedRedirect(target, entryId);
			redirect(303, next);
		} catch (cause) {
			if (cause instanceof AppError) return failureOf(cause);
			throw cause;
		}
	},
	cerrarSesiones: async ({ locals, params, request }) => {
		const admin = adminOrThrow(locals);
		const form = await request.formData();
		if (!isConfirmed(form)) return fail(400, { formError: 'VALIDATION_ERROR' });
		const sessionValue = form.get('sesion');
		try {
			closeUserSessions(getComposition().adminUsers, {
				adminId: admin.id,
				userId: params.userId,
				sessionId: typeof sessionValue === 'string' && sessionValue !== '' ? sessionValue : null,
				reason: reasonOf(form)
			});
			const back = `${resolve('/admin/usuarios')}/${encodeURIComponent(params.userId)}`;
			redirect(303, back);
		} catch (cause) {
			if (cause instanceof AppError) return failureOf(cause);
			throw cause;
		}
	}
};
