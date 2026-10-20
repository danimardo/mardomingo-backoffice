// Presentación de un documento legal vigente para las páginas públicas W04–W07 (T351; contracts/web-routes.md). El texto
// versionado se sirve como HTML generado aquí, con el escape del subconjunto de Markdown; nunca se interpreta HTML guardado.
import { civilDateOf } from '$lib/shared/dates';
import type { CivilDate } from '$lib/shared/time';
import { renderMarkdown } from './domain/markdown';
import type { LegalDocumentName, PublishedDocument } from './repository';

export interface LegalDocumentView {
	readonly kind: LegalDocumentName;
	readonly version: string;
	/** Día de publicación en Europe/Madrid (`YYYY-MM-DD`). */
	readonly publishedOn: CivilDate;
	readonly contentHtml: string;
}

export function legalDocumentView(document: PublishedDocument): LegalDocumentView {
	return {
		kind: document.document,
		version: document.version,
		publishedOn: civilDateOf(document.publishedAt),
		contentHtml: renderMarkdown(document.content)
	};
}
