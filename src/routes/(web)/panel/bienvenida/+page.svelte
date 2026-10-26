<script lang="ts">
	import { resolve } from '$app/paths';
	import Notice from '$lib/components/ui/Notice.svelte';
	import { formatCredits } from '$lib/format/credits';
	import * as m from '$lib/paraglide/messages.js';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	/** Día de caducidad en Madrid, con el texto de las fechas de la interfaz. */
	const expiresText = $derived(
		data.welcome.expiresOn === null
			? ''
			: new Date(`${data.welcome.expiresOn}T12:00:00Z`).toLocaleDateString('es-ES', {
					day: 'numeric',
					month: 'long',
					year: 'numeric',
					timeZone: 'Europe/Madrid'
				})
	);
</script>

<svelte:head>
	<title>{m.accounts_welcome_title()}</title>
</svelte:head>

<h1>{m.accounts_welcome_title()}</h1>
<Notice tone="success">
	<p>{m.accounts_welcome_intro({ email: data.email })}</p>
</Notice>
{#if data.welcome.status === 'granted'}
	<p>
		{m.accounts_welcome_credits_granted({
			amount: formatCredits(data.welcome.grantedMicro),
			date: expiresText
		})}
	</p>
{:else}
	<p>{m.accounts_welcome_credits_not_granted()}</p>
{/if}
<h2>{m.accounts_welcome_next_title()}</h2>
{#if data.nextSteps.customText}
	<p>{data.nextSteps.customText}</p>
{:else}
	<p>{m.accounts_welcome_next_generic()}</p>
{/if}
<p><a href={resolve('/panel')}>{m.panel_title()}</a></p>
