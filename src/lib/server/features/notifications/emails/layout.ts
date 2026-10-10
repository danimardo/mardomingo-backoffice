// Layout común de los emails de la cuenta (BE-FR-58, FR-098): funciones puras que devuelven `{ subject, text, html }`
// con los textos de Paraglide. Texto plano completo (el enlace también va visible), pie con el email de soporte y
// `color-scheme light dark`. Ningún dato dinámico llega al HTML sin escapar.
import * as m from '$lib/paraglide/messages.js';

export interface EmailContent {
	readonly subject: string;
	readonly text: string;
	readonly html: string;
}

export interface EmailAction {
	readonly label: string;
	readonly url: string;
	readonly fallback: string;
}

export interface LayoutInput {
	readonly subject: string;
	readonly lead: string;
	readonly action?: EmailAction;
	/** Nombre visible de la app cuando el email se refiere a una (BE-FR-64 CA3); `null` en la web. */
	readonly appName: string | null;
	readonly supportEmail: string;
}

const ESCAPES: Readonly<Record<string, string>> = Object.freeze({
	'&': '&amp;',
	'<': '&lt;',
	'>': '&gt;',
	'"': '&quot;',
	"'": '&#39;'
});

/** Escapa el texto para HTML. Se aplica a cualquier valor que venga de fuera (nombre de app, email, enlace). */
export function escapeHtml(value: string): string {
	return value.replace(/[&<>"']/g, (char) => ESCAPES[char] ?? char);
}

export function renderLayout(input: LayoutInput): EmailContent {
	const appLine = input.appName === null ? [] : [m.notifications_app_line({ app: input.appName })];
	const actionText =
		input.action === undefined ? [] : [`${input.action.label}: ${input.action.url}`];
	const footer = [
		m.notifications_footer_brand(),
		m.notifications_footer_support({ email: input.supportEmail }),
		m.notifications_footer_automatic()
	];
	const text = [input.lead, ...appLine, ...actionText, '', ...footer].join('\n');

	const actionHtml =
		input.action === undefined
			? ''
			: `<p><a href="${escapeHtml(input.action.url)}" style="display:inline-block;padding:12px 18px;border-radius:8px;background:#3f6b5a;color:#ffffff;text-decoration:none;">${escapeHtml(input.action.label)}</a></p>` +
				`<p>${escapeHtml(input.action.fallback)}<br><a href="${escapeHtml(input.action.url)}">${escapeHtml(input.action.url)}</a></p>`;
	const appHtml = appLine.map((line) => `<p>${escapeHtml(line)}</p>`).join('');
	const html =
		'<!doctype html><html lang="es"><head><meta charset="utf-8">' +
		'<meta name="color-scheme" content="light dark">' +
		`<title>${escapeHtml(input.subject)}</title></head>` +
		'<body style="margin:0;padding:24px;font-family:system-ui,sans-serif;line-height:1.5;">' +
		`<h1 style="font-size:1.25rem;">${escapeHtml(input.subject)}</h1>` +
		`<p>${escapeHtml(input.lead)}</p>${appHtml}${actionHtml}` +
		`<hr><p style="font-size:0.875rem;">${footer.map(escapeHtml).join('<br>')}</p>` +
		'</body></html>';

	return { subject: input.subject, text, html };
}
