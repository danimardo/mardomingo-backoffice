// W35 · `/admin/usuarios/[userId]` (contracts/web-routes.md W35; BE-FR-50, BE-FR-18; T306). Ficha de la cuenta con sus acciones de
// administración: bloquear, desbloquear, marcar o desmarcar tester, y cerrar sesiones. Las acciones destructivas siguen el
// patrón de confirmación: `previsualizar` no cambia nada; la acción aplica solo con `confirmado=true`, y el motivo es obligatorio.
// Pendiente (anotado en tasks.md): saldo, reservas, bolsas, movimientos, consumo, pagos y facturas de la ficha.
import { error, fail, redirect } from '@sveltejs/kit';
import { resolve } from '$app/paths';
import { getComposition } from '$lib/server/composition.cache';
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

export const load: PageServerLoad = ({ locals, params, setHeaders }) => {
	adminOrThrow(locals);
	setHeaders({ 'cache-control': 'private, no-store' });
	const composition = getComposition();
	const account = accountView(composition.adminUsers, params.userId);
	if (account === null) error(404);
	const balance = composition.credits.getBalance(params.userId);
	const movements = composition.credits.movements({
		userId: params.userId,
		fromMs: null,
		toMs: null,
		appId: null,
		page: 1
	});
	return {
		account,
		balance: {
			totalMicro: balance.totalMicro,
			availableMicro: balance.availableMicro,
			debtMicro: balance.debtMicro
		},
		movements: movements.rows.map((row) => ({
			type: row.type,
			amountMicro: row.amountMicro,
			createdAt: new Date(row.createdAt).toISOString()
		}))
	};
};

export const actions: Actions = {
	// Vista previa: dice qué cambiaría y no cambia nada.
	previsualizar: async ({ locals, params, request }) => {
		adminOrThrow(locals);
		const form = await request.formData();
		const account = accountView(getComposition().adminUsers, params.userId);
		if (account === null) error(404);
		return {
			preview: {
				subject: account.email,
				banned: account.banned,
				role: account.role,
				reason: reasonOf(form),
				action: form.get('accion')
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
				reason: reasonOf(form) || null
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
