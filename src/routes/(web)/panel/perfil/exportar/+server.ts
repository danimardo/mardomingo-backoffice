// W28 · `GET /panel/perfil/exportar` (contracts/web-routes.md W28; BE-FR-08, FR-105; T281). Descarga en JSON todo lo que la
// plataforma guarda de la cuenta que la pide: nunca de otra, porque el id sale de la sesión y no de la URL. Sin sesión manda al
// login. Si la exportación falla, vuelve a W27 con el aviso `export_failed` (estado «fallida» de 16.6). La respuesta no se guarda
// en ninguna caché y su contenido nunca se registra (solo la duración). «En curso» y «descargada» solo las ve el navegador: el
// servidor no sabe si la descarga terminó, así que no se muestran desde aquí.
import { redirect } from '@sveltejs/kit';
import { resolve } from '$app/paths';
import { getComposition } from '$lib/server/composition.cache';
import { accessFor } from '$lib/server/features/accounts';
import { civilDateOf } from '$lib/shared/dates';
import { toEpochMs } from '$lib/shared/time';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = ({ locals }) => {
	const access = accessFor(locals.user, 'verified');
	if (access.kind !== 'allow') {
		const login = resolve('/login');
		redirect(303, login);
	}
	const composition = getComposition();
	let body: string;
	try {
		body = JSON.stringify(composition.privacy.exportUserData(access.user.id), null, 2);
	} catch {
		// El fallo ya lo registra la capa que lo produjo; aquí solo se avisa a la persona sin detalles.
		const back = `${resolve('/panel/perfil')}?aviso=export_failed`;
		redirect(303, back);
	}
	const day = civilDateOf(toEpochMs(composition.clock.now()));
	return new Response(body, {
		status: 200,
		headers: {
			'content-type': 'application/json; charset=utf-8',
			'content-disposition': `attachment; filename="cuenta-mardomingo-datos-${day}.json"`,
			'cache-control': 'private, no-store'
		}
	});
};
