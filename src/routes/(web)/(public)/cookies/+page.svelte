<script lang="ts">
	// W06 · Documento de cookies y, debajo, la declaración técnica de las cookies que emite la web (T351): la de sesión y las
	// dos de preferencias. Son todas técnicas, por eso no hay banner de consentimiento (BE-FR-60).
	import DataTable from '$lib/components/ui/DataTable.svelte';
	import LegalDocument from '$lib/components/legal/LegalDocument.svelte';
	import * as m from '$lib/paraglide/messages.js';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	const columns = [
		{ key: 'name', label: m.legal_cookies_col_name(), align: 'start' as const },
		{ key: 'purpose', label: m.legal_cookies_col_purpose(), align: 'start' as const },
		{ key: 'duration', label: m.legal_cookies_col_duration(), align: 'start' as const }
	];
	const rows = [
		['better-auth.session_token', m.legal_cookies_session(), m.legal_cookies_session_duration()],
		['mdm_theme', m.legal_cookies_theme(), m.legal_cookies_preference_duration()],
		['mdm_effects', m.legal_cookies_effects(), m.legal_cookies_preference_duration()]
	];
</script>

<svelte:head>
	<title>{m.legal_cookies_title()}</title>
</svelte:head>

<LegalDocument
	title={m.legal_cookies_title()}
	version={data.document.version}
	publishedOn={data.document.publishedOn}
	contentHtml={data.document.contentHtml}
/>

<section aria-labelledby="cookies-lista">
	<h2 id="cookies-lista">{m.legal_cookies_list_title()}</h2>
	<DataTable caption={m.legal_cookies_list_caption()} {columns} {rows} />
</section>
