<script lang="ts">
	import { resolve } from '$app/paths';
	import * as m from '$lib/paraglide/messages.js';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
</script>

<svelte:head>
	<title>{m.panel_title()}</title>
</svelte:head>

<h1>{m.panel_title()}</h1>
<p>{m.panel_signed_as({ email: data.email })}</p>
<p><a href={resolve('/logout')}>{m.accounts_logout_action()}</a></p>

<nav aria-label={m.panel_nav_label()}>
	<ul>
		<li><a href={resolve('/panel/comprar')}>{m.payments_title()}</a></li>
	</ul>
</nav>
