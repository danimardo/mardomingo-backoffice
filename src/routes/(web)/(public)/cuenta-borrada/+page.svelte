<script lang="ts">
	// W17 · `/cuenta-borrada`: confirmación estática del borrado de la cuenta (T285; BE-FR-07; UX-07). Es pública porque la sesión
	// ya no existe.
	import { resolve } from '$app/paths';
	import Button from '$lib/components/ui/Button.svelte';
	import Notice from '$lib/components/ui/Notice.svelte';
	import * as m from '$lib/paraglide/messages.js';
</script>

<svelte:head>
	<title>{m.privacy_deleted_title()}</title>
</svelte:head>

<h1>{m.privacy_deleted_title()}</h1>

<Notice tone="success"><p>{m.privacy_deleted_body()}</p></Notice>

<p><Button href={resolve('/')} variant="primary">{m.privacy_deleted_home()}</Button></p>
