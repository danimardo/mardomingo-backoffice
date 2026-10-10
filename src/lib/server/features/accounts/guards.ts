// _Guards_ de la web y de la API (contracts/web-routes.md 1.2; T098). Son decisiones puras: la sesión entra y sale una
// decisión. Cada `load`, action o `+server.ts` protegido la traduce a `redirect`, `fail` o `error` según el caso; el
// `load` de un _layout_ nunca es barrera.

export interface SessionUser {
	readonly id: string;
	readonly email: string;
	readonly emailVerified: boolean;
	readonly banned: boolean;
	/** Roles separados por comas (`user`, `tester`, `admin`). */
	readonly role: string;
}

export type Requirement = 'user' | 'verified' | 'admin';

export type Access =
	| { readonly kind: 'allow'; readonly user: SessionUser }
	| { readonly kind: 'anonymous' }
	| { readonly kind: 'unverified' }
	| { readonly kind: 'blocked' }
	| { readonly kind: 'not_admin' };

/** Decide si la sesión cumple lo que exige la ruta: sesión, email verificado o rol de administrador. */
export function accessFor(sessionUser: SessionUser | null, requirement: Requirement): Access {
	if (sessionUser === null) return { kind: 'anonymous' };
	if (sessionUser.banned) return { kind: 'blocked' };
	if (requirement === 'user') return { kind: 'allow', user: sessionUser };
	if (!sessionUser.emailVerified) return { kind: 'unverified' };
	if (requirement === 'verified') return { kind: 'allow', user: sessionUser };
	return sessionUser.role.split(',').includes('admin')
		? { kind: 'allow', user: sessionUser }
		: { kind: 'not_admin' };
}

/** Motivo y estado HTTP de una denegación, para el evento `accounts.guard.denied` (sin datos personales). */
export function denialOf(access: Access): {
	readonly reason: 'anonymous' | 'unverified' | 'not_admin';
	readonly httpStatus: number;
} | null {
	if (access.kind === 'anonymous' || access.kind === 'blocked')
		return { reason: 'anonymous', httpStatus: 303 };
	if (access.kind === 'unverified') return { reason: 'unverified', httpStatus: 303 };
	if (access.kind === 'not_admin') return { reason: 'not_admin', httpStatus: 403 };
	return null;
}
