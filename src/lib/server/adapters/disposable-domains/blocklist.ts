// Adaptador de la lista pública de dominios desechables (BE-FR-11.2, FR-019; T340). Fuente: el proyecto
// disposable-email-domains (licencia CC0 1.0; https://github.com/disposable-email-domains/disposable-email-domains).
// Un fichero con un dominio por línea. Si la respuesta no es válida o parece vacía, no se usa: se conserva la lista anterior.
export const DISPOSABLE_BLOCKLIST_URL =
	'https://raw.githubusercontent.com/disposable-email-domains/disposable-email-domains/master/disposable_email_blocklist.conf';
/** Por debajo de este número de dominios la lista se considera truncada o vacía y no se usa. */
export const MIN_BLOCKLIST_DOMAINS = 100;
const DOMAIN = /^(?=.{1,253}$)([a-z0-9-]{1,63}\.)+[a-z]{2,63}$/;

export type BlocklistFetch =
	| { readonly status: 'ok'; readonly domains: readonly string[] }
	| { readonly status: 'error'; readonly httpStatus: number | null };

/** Interpreta el fichero: una línea por dominio; las vacías y las que empiezan por `#` se ignoran. */
export function parseBlocklist(text: string): string[] {
	const domains = new Set<string>();
	for (const raw of text.split(/\r?\n/)) {
		const line = raw.trim().toLowerCase();
		if (line === '' || line.startsWith('#')) continue;
		if (DOMAIN.test(line)) domains.add(line);
	}
	return [...domains].sort();
}

export async function fetchBlocklist(url: string, timeoutMs = 15_000): Promise<BlocklistFetch> {
	try {
		const response = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) });
		if (!response.ok) return { status: 'error', httpStatus: response.status };
		const domains = parseBlocklist(await response.text());
		if (domains.length < MIN_BLOCKLIST_DOMAINS) return { status: 'error', httpStatus: null };
		return { status: 'ok', domains };
	} catch {
		return { status: 'error', httpStatus: null };
	}
}
