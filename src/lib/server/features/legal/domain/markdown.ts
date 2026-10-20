// Subconjunto de Markdown para servir `legal_documents.content` (T347, D-14): encabezados de nivel 1 a 4, párrafos, listas
// (con viñeta o numeradas), enlaces, énfasis y código en línea. Sin dependencias. Todo el texto de entrada se escapa antes
// de interpretar nada, y un enlace solo se admite con `https:`, `http:`, `mailto:` o una ruta interna: el resto queda como
// texto, así que el resultado no puede inyectar HTML ni `javascript:`.

const ESCAPES: Readonly<Record<string, string>> = Object.freeze({
	'&': '&amp;',
	'<': '&lt;',
	'>': '&gt;',
	'"': '&quot;',
	"'": '&#39;'
});

function escapeHtml(text: string): string {
	return text.replace(/[&<>"']/g, (char) => String(ESCAPES[char]));
}

const SAFE_HREF = /^(?:https?:\/\/|mailto:|\/(?!\/))/i;
const CODE_SPAN = /`([^`\n]+)`/g;
const LINK = /\[([^\]\n]+)\]\(([^)\s]+)\)/g;
const STRONG = /\*\*(?=\S)(.+?)(?<=\S)\*\*/g;
const EMPHASIS_STAR = /\*(?=\S)(.+?)(?<=\S)\*/g;
const EMPHASIS_UNDERSCORE = /(?<![\p{L}\p{N}_])_(?=\S)(.+?)(?<=\S)_(?![\p{L}\p{N}_])/gu;

/** Texto en línea: escapa y después aplica código, enlaces y énfasis. El código se aparta para que nada actúe dentro. */
/** Marca de los códigos en línea (U+E000, de uso privado): se quita de la entrada para que solo la genere el propio renderizado. */
const MARK = '';

function renderInline(source: string): string {
	const codes: string[] = [];
	let text = escapeHtml(source.replaceAll(MARK, '')).replace(CODE_SPAN, (_match, code: string) => {
		codes.push(`<code>${code}</code>`);
		return `${String(codes.length - 1)}`;
	});
	text = text.replace(LINK, (_match, label: string, href: string) =>
		SAFE_HREF.test(href) ? `<a href="${href}">${label}</a>` : label
	);
	text = text
		.replace(STRONG, '<strong>$1</strong>')
		.replace(EMPHASIS_STAR, '<em>$1</em>')
		.replace(EMPHASIS_UNDERSCORE, '<em>$1</em>');
	return text.replace(/(\d+)/g, (_match, index: string) => String(codes[Number(index)]));
}

const HEADING = /^(#{1,4})\s+(.+?)\s*#*\s*$/;
const BULLET = /^[-*]\s+(.*)$/;
const NUMBERED = /^\d+\.\s+(.*)$/;

/** Convierte el Markdown de un documento legal a HTML. Un texto vacío da una cadena vacía. */
export function renderMarkdown(markdown: string): string {
	const blocks: string[] = [];
	let paragraph: string[] = [];
	let list: { readonly tag: 'ul' | 'ol'; readonly items: string[] } | null = null;

	const flushParagraph = (): void => {
		if (paragraph.length > 0) blocks.push(`<p>${renderInline(paragraph.join(' '))}</p>`);
		paragraph = [];
	};
	const flushList = (): void => {
		if (list !== null) {
			const items = list.items.map((item) => `<li>${renderInline(item)}</li>`).join('\n');
			blocks.push(`<${list.tag}>\n${items}\n</${list.tag}>`);
		}
		list = null;
	};
	const flush = (): void => {
		flushParagraph();
		flushList();
	};

	for (const raw of markdown.replace(/\r\n?/g, '\n').split('\n')) {
		const line = raw.trim();
		if (line === '') {
			flush();
			continue;
		}
		const heading = HEADING.exec(line);
		if (heading !== null) {
			flush();
			const level = String(heading[1]).length;
			const tag = `h${String(level)}`;
			blocks.push(`<${tag}>${renderInline(String(heading[2]))}</${tag}>`);
			continue;
		}
		const bullet = BULLET.exec(line);
		const numbered = bullet === null ? NUMBERED.exec(line) : null;
		const item = bullet ?? numbered;
		if (item !== null) {
			const tag = bullet !== null ? 'ul' : 'ol';
			flushParagraph();
			if (list !== null && list.tag !== tag) flushList();
			list ??= { tag, items: [] };
			list.items.push(String(item[1]));
			continue;
		}
		// Una línea suelta tras un elemento de lista, con sangría, continúa ese elemento; sin sangría, abre un párrafo.
		if (list !== null && /^\s/.test(raw)) {
			const items = list.items;
			items[items.length - 1] = `${String(items[items.length - 1])} ${line}`;
			continue;
		}
		flushList();
		paragraph.push(line);
	}
	flush();
	return blocks.join('\n');
}
