// Lógica de W29 · borrado de cuenta (contracts/web-routes.md W29; BE-FR-07, UX-07). Está fuera de la acción de SvelteKit para
// probarla con entradas simples: la página solo traduce el resultado a `redirect` o a `fail`.
import type { ActionFailure } from '@sveltejs/kit';
import type { Composition } from '$lib/server/composition';
import {
	accessFor,
	appsUsedBy,
	type Access,
	type SessionUser
} from '$lib/server/features/accounts';
import { appNamesOf } from '$lib/server/features/apps';
import { syncedAppIds } from '$lib/server/features/sync';
import {
	DELETE_ACCOUNT_CHECKBOXES,
	DeleteAccountSchema
} from '$lib/schemas/privacy/delete-account';
import { parseForm, type FormFailure } from '$lib/server/forms';
import { AppError } from '$lib/server/shared/errors';
import { failureOf } from './actions';
import { balanceEurCentsOf } from './balance-eur';

export interface DeleteAccountView {
	/** Lo que se pierde al borrar: lo que hay en las bolsas, en micro-créditos y en céntimos de euro (nulo sin paquetes). */
	readonly loss: { readonly totalMicro: number; readonly eurEquivalentCents: number | null };
	/** Nombres de las apps que la cuenta ha usado o en las que tiene datos sincronizados, por orden alfabético. */
	readonly affectedApps: readonly string[];
}

/** Modelo de vista de W29. La deuda no se pierde: no coexiste con saldo positivo y el borrado no la perdona. */
export function deleteAccountView(composition: Composition, userId: string): DeleteAccountView {
	const balance = composition.credits.getBalance(userId);
	const lossMicro = balance.freeMicro + balance.paidMicro;
	const appIds = [
		...new Set([...appsUsedBy(composition.db, userId), ...syncedAppIds(composition.db, userId)])
	];
	const names = appNamesOf(composition.apps, appIds);
	return {
		loss: {
			totalMicro: lossMicro,
			eurEquivalentCents: balanceEurCentsOf(lossMicro, composition.payments.packsForSale())
		},
		affectedApps: appIds
			.map((id) => names.get(id))
			.filter((name): name is string => name !== undefined)
			.sort((left, right) => left.localeCompare(right, 'es'))
	};
}

export type DeleteAccountSubmit =
	| { readonly kind: 'denied'; readonly access: Exclude<Access, { readonly kind: 'allow' }> }
	| { readonly kind: 'deleted' }
	| {
			readonly kind: 'failure';
			readonly failure: ActionFailure<FormFailure> | ReturnType<typeof failureOf>;
	  };

/**
 * Borra la cuenta de la sesión con la contraseña y la casilla del formulario. Exige cuenta verificada. Una contraseña errónea o
 * una casilla sin marcar no cambian nada. Al borrar, borra también la cookie de sesión de la petición.
 */
export async function submitDeleteAccount(
	composition: Composition,
	sessionUser: SessionUser | null,
	form: FormData,
	headers: Headers
): Promise<DeleteAccountSubmit> {
	const access = accessFor(sessionUser, 'verified');
	if (access.kind !== 'allow') return { kind: 'denied', access };

	const parsed = parseForm(DeleteAccountSchema, form, { booleans: DELETE_ACCOUNT_CHECKBOXES });
	if (!parsed.ok) return { kind: 'failure', failure: parsed.failure };

	const outcome = await composition.privacy.deleteAccount({
		userId: access.user.id,
		reason: 'user',
		password: parsed.data.password
	});
	if (outcome.status === 'wrong_password') {
		return { kind: 'failure', failure: failureOf(new AppError('WRONG_PASSWORD')) };
	}
	if (outcome.status === 'not_found') {
		return { kind: 'failure', failure: failureOf(new AppError('NOT_FOUND')) };
	}
	await composition.accounts.clearSessionCookie(headers);
	return { kind: 'deleted' };
}
