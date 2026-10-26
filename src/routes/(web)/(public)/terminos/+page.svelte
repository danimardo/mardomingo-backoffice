<script lang="ts">
	import LegalDocument from '$lib/components/legal/LegalDocument.svelte';
	import * as m from '$lib/paraglide/messages.js';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
</script>

<svelte:head>
	<title>{m.legal_terms_title()}</title>
</svelte:head>

<LegalDocument
	title={m.legal_terms_title()}
	version={data.document.version}
	publishedOn={data.document.publishedOn}
	contentHtml={data.document.contentHtml}
/>
