// Lista inicial versionada de dominios de email desechables (BE-FR-11 CA2). El refresco semanal desde la fuente
// externa llega en L14; mientras tanto, esta lista es la de partida y se siembra en el arranque sin redesplegar nada
// después (los dominios nuevos se añaden a la tabla, no al código). Todos en minúsculas.
export const DISPOSABLE_DOMAINS_V1: readonly string[] = Object.freeze([
	'10minutemail.com',
	'burnermail.io',
	'discard.email',
	'dispostable.com',
	'emailondeck.com',
	'fakeinbox.com',
	'getnada.com',
	'guerrillamail.com',
	'guerrillamail.net',
	'maildrop.cc',
	'mailnesia.com',
	'mailinator.com',
	'mintemail.com',
	'mohmal.com',
	'moakt.com',
	'mytrashmail.com',
	'sharklasers.com',
	'spamgourmet.com',
	'tempinbox.com',
	'tempmail.com',
	'tempr.email',
	'temp-mail.org',
	'throwawaymail.com',
	'trashmail.com',
	'yopmail.com'
]);
