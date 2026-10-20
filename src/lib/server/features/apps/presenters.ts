// Presentación de las landings públicas de las apps (T346; BE-FR-59, FR-100, FR-101; contracts/web-routes.md W01 y W02).
// Funciones puras: reciben filas ya leídas y devuelven los modelos de vista con claves exactas. No exponen el estado
// interno de la app, los orígenes CORS ni su configuración.
import type { AppLinks, ClientTypes } from './json-schemas';

export interface LandingAppRow {
	readonly slug: string;
	readonly name: string;
	readonly description: string;
	readonly status: 'active' | 'disabled';
	readonly clientTypes: ClientTypes;
	readonly links: AppLinks;
	readonly supportEmail: string | null;
}

export interface LandingListItem {
	readonly slug: string;
	readonly name: string;
	readonly description: string;
	/** `url` es la dirección de la landing externa; con landing interna es `null` (la página es `/apps/<slug>`). */
	readonly landing: { readonly kind: 'internal' | 'external'; readonly url: string | null };
}

/** Apps activas de la landing de la marca (W01), por nombre. */
export function landingListOf(rows: readonly LandingAppRow[]): LandingListItem[] {
	return rows
		.filter((row) => row.status === 'active')
		.map((row) => ({
			slug: row.slug,
			name: row.name,
			description: row.description,
			landing:
				row.links.landing.type === 'external'
					? { kind: 'external' as const, url: row.links.landing.url }
					: { kind: 'internal' as const, url: null }
		}))
		.sort((a, b) => a.name.localeCompare(b.name, 'es'));
}

export interface AppPage {
	readonly app: {
		readonly slug: string;
		readonly name: string;
		readonly description: string;
		readonly clientTypes: ClientTypes;
		/** Solo las apps de escritorio. Sin enlace configurado, `available` es `false`. */
		readonly download: { readonly url: string | null; readonly available: boolean } | null;
		/** Dirección de uso de una app web. */
		readonly access: { readonly url: string } | null;
		readonly externalLanding: string | null;
		/** Un instalador `.exe` sin firmar activa SmartScreen: la página explica los pasos (UX-16). */
		readonly smartScreenHelp: boolean;
	};
	readonly disabled: boolean;
	/** Enlace de alta con la app de origen; `null` si la app está desactivada. */
	readonly registerHref: string | null;
	readonly supportEmail: string;
}

/** Landing de una app (W02). Una app desactivada se muestra con su aviso, sin descarga ni alta. */
export function appPageOf(row: LandingAppRow, globalSupportEmail: string): AppPage {
	const disabled = row.status === 'disabled';
	const externalUrl = row.links.landing.type === 'external' ? row.links.landing.url : null;
	const downloadUrl = row.links.download_url ?? null;
	const download =
		!disabled && row.clientTypes.includes('desktop')
			? { url: downloadUrl, available: downloadUrl !== null }
			: null;
	const access =
		!disabled && row.clientTypes.includes('web') && externalUrl !== null
			? { url: externalUrl }
			: null;
	return {
		app: {
			slug: row.slug,
			name: row.name,
			description: row.description,
			clientTypes: row.clientTypes,
			download,
			access,
			externalLanding: disabled ? null : externalUrl,
			smartScreenHelp:
				download !== null && downloadUrl !== null && /\.exe(?:$|[?#])/i.test(downloadUrl)
		},
		disabled,
		registerHref: disabled ? null : `/registro?app=${encodeURIComponent(row.slug)}`,
		supportEmail: row.supportEmail ?? globalSupportEmail
	};
}
