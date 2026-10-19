// Altas, primeros inicios de sesión por app y cuentas activas de un periodo (BE-FR-54; T318). Solo lectura de `user` y
// `user_app_activity`. Las altas se cuentan por la app de origen (`signup_app_id`); una cuenta borrada conserva su alta.
import { and, asc, gte, isNotNull, isNull, lte } from 'drizzle-orm';
import type { Db } from '$lib/server/db/client';
import { civilDateOf } from '$lib/shared/dates';
import { toEpochMs } from '$lib/shared/time';
import { user, userAppActivity } from './schema';

export interface SignupFact {
	readonly date: string;
	readonly appId: string | null;
	/** La cuenta ya verificó su email (BE-FR-03). */
	readonly verified: boolean;
}

export interface FirstLoginFact {
	readonly date: string;
	readonly appId: string;
}

export function signupsBetween(
	db: Pick<Db, 'select'>,
	input: { readonly fromMs: number; readonly toMs: number }
): SignupFact[] {
	return db
		.select({ createdAt: user.createdAt, appId: user.signupAppId, verified: user.emailVerified })
		.from(user)
		.where(
			and(gte(user.createdAt, new Date(input.fromMs)), lte(user.createdAt, new Date(input.toMs)))
		)
		.orderBy(asc(user.createdAt))
		.all()
		.map((row) => ({
			date: civilDateOf(toEpochMs(row.createdAt.getTime())),
			appId: row.appId,
			verified: row.verified
		}));
}

export function firstLoginsBetween(
	db: Pick<Db, 'select'>,
	input: { readonly fromMs: number; readonly toMs: number }
): FirstLoginFact[] {
	return db
		.select({ firstLoginAt: userAppActivity.firstLoginAt, appId: userAppActivity.appId })
		.from(userAppActivity)
		.where(
			and(
				gte(userAppActivity.firstLoginAt, toEpochMs(input.fromMs)),
				lte(userAppActivity.firstLoginAt, toEpochMs(input.toMs))
			)
		)
		.orderBy(asc(userAppActivity.firstLoginAt))
		.all()
		.map((row) => ({ date: civilDateOf(toEpochMs(row.firstLoginAt)), appId: row.appId }));
}

/** Cuentas con actividad en el periodo (último acceso dentro del intervalo), sin contar las borradas. */
export function activeUsersBetween(
	db: Pick<Db, 'select'>,
	input: { readonly fromMs: number; readonly toMs: number }
): number {
	return db
		.select({ id: user.id })
		.from(user)
		.where(
			and(
				isNotNull(user.lastActivityAt),
				gte(user.lastActivityAt, toEpochMs(input.fromMs)),
				lte(user.lastActivityAt, toEpochMs(input.toMs)),
				isNull(user.deletedAt)
			)
		)
		.all().length;
}
