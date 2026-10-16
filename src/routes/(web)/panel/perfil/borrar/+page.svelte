<script lang="ts">
	// W29 · `/panel/perfil/borrar`: borrado de la cuenta con aviso de lo que se pierde (T285; BE-FR-07; UX-07). Sin JavaScript
	// funciona igual: es un formulario con POST.
	import { resolve } from '$app/paths';
	import DeleteAccountForm from '$lib/components/privacy/DeleteAccountForm.svelte';
	import { formStateOf } from '$lib/components/accounts/form-state';
	import * as m from '$lib/paraglide/messages.js';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();
	const formState = $derived(formStateOf(form));
</script>

<svelte:head>
	<title>{m.privacy_delete_title()}</title>
</svelte:head>

<h1>{m.privacy_delete_title()}</h1>

<DeleteAccountForm
	lossMicro={data.loss.totalMicro}
	lossEurCents={data.loss.eurEquivalentCents}
	apps={data.affectedApps}
	errors={formState.errors}
	formError={formState.formError}
	profileHref={resolve('/panel/perfil')}
/>
