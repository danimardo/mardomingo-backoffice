<script lang="ts">
	// Grupo de opciones nativo (DS-06; T255): `fieldset` con `legend` y radios reales, navegables con teclado sin JavaScript.
	let {
		name,
		legend,
		options,
		value = ''
	}: {
		name: string;
		legend: string;
		options: readonly { readonly value: string; readonly label: string }[];
		value?: string;
	} = $props();
</script>

<fieldset>
	<legend>{legend}</legend>
	{#each options as option (option.value)}
		<label class="option">
			<input type="radio" {name} value={option.value} checked={option.value === value} />
			<span>{option.label}</span>
		</label>
	{/each}
</fieldset>

<style>
	fieldset {
		display: grid;
		gap: 0.5rem;
		border: 1px solid var(--border-subtle);
		border-radius: 0.5rem;
		padding: 0.75rem 1rem;
	}
	.option {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		min-height: 44px;
	}
</style>
