<script lang="ts">
	import EffectsToggle from '$lib/components/layout/EffectsToggle.svelte';
	import ThemeToggle from '$lib/components/layout/ThemeToggle.svelte';
	import * as m from '$lib/paraglide/messages.js';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
</script>

<svelte:head>
	<title>{m.appearance_title()}</title>
</svelte:head>

<h1>{m.appearance_title()}</h1>
<p>{m.appearance_intro()}</p>

<ThemeToggle current={data.appearance.theme} redirectTo={data.redirectTo} />
<EffectsToggle current={data.appearance.effects} redirectTo={data.redirectTo} />
