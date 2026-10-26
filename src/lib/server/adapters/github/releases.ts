// Adaptador de GitHub: lectura pública de los releases de un repositorio para las descargas (L14; sin token). El repositorio debe
// ser público. Sigue la paginación de la cabecera `Link` y valida la respuesta: lo que no tenga la forma esperada no se cuenta.
// La versión de la API es `2026-03-10` (la vigente, según el anuncio de GitHub del 10-mar-2026; la anterior, 2022-11-28, sigue
// soportada).
import * as z from 'zod';

export const GITHUB_API_VERSION = '2026-03-10';
const DEFAULT_BASE_URL = 'https://api.github.com';
const MAX_PAGES = 10;

const ReleasesBody = z.array(
	z.object({ assets: z.array(z.object({ download_count: z.number().int().nonnegative() })) })
);

export interface ReleasesOptions {
	/** `https://api.github.com` en producción; el simulador en pruebas. */
	readonly baseUrl?: string;
}

/** URL de la página siguiente según la cabecera `Link` (`rel="next"`), o nula si no hay más. */
export function nextPageOf(link: string | null): string | null {
	if (link === null) return null;
	for (const part of link.split(',')) {
		const match = /<([^>]+)>;\s*rel="next"/.exec(part);
		if (match?.[1] !== undefined) return match[1];
	}
	return null;
}

export async function fetchPublicReleases(
	repo: string,
	options: ReleasesOptions = {}
): Promise<z.infer<typeof ReleasesBody>> {
	const first = `${options.baseUrl ?? DEFAULT_BASE_URL}/repos/${repo}/releases?per_page=100`;
	const releases: z.infer<typeof ReleasesBody> = [];
	let url: string | null = first;
	for (let page = 0; url !== null && page < MAX_PAGES; page += 1) {
		const response: Response = await fetch(url, {
			headers: {
				accept: 'application/vnd.github+json',
				'x-github-api-version': GITHUB_API_VERSION,
				'user-agent': 'cuenta-mardomingo-stats'
			}
		});
		if (!response.ok) throw new Error(`GitHub respondió ${String(response.status)} para ${repo}`);
		releases.push(...ReleasesBody.parse(await response.json()));
		url = nextPageOf(response.headers.get('link'));
	}
	return releases;
}
