<script lang="ts">
	/**
	 * CommandMenu (ampliación 3, §10 — dejado fuera en Fase 3 junto con
	 * `Submenu`/`ContextMenu`/`MegaMenu`, ver `docs/ROADMAP.md`; los
	 * otros tres ya se construyeron en las ampliaciones 1/2/3) — la
	 * pieza que de verdad necesitaba su "propio trabajo verificado": NO
	 * reutiliza `Menu`/`MenuItem` (roving tabindex) porque el patrón
	 * aquí es otro por completo, el de un COMBOBOX con listbox filtrado
	 * (WAI-ARIA "Combobox with List Autocomplete"):
	 *
	 *   - El foco de TECLADO real se queda siempre en el `<input>` —
	 *     nunca salta a las opciones (a diferencia de `Menu`, donde cada
	 *     `MenuItem` recibe el foco de verdad uno a uno).
	 *   - La opción "activa" (la que `↓`/`↑` mueven) se comunica con
	 *     `aria-activedescendant` en el propio `<input>`, apuntando al
	 *     `id` de la opción resaltada — el input lleva
	 *     `role="combobox"`/`aria-expanded`/`aria-controls` hacia un
	 *     `role="listbox"` de opciones `role="option"`/`aria-selected`.
	 *     Esto es justo la "`aria-activedescendant`" que
	 *     `docs/ROADMAP.md` llevaba desde la Fase 3 señalando como el
	 *     motivo de que esta pieza necesitara trabajo propio.
	 *   - Escribir en el input FILTRA la lista (coincidencia simple,
	 *     insensible a mayúsculas, contra `label` + `keywords`
	 *     opcionales) — ninguna otra pieza de navegación del paquete
	 *     filtra nada, así que tampoco hay una base compartida de la que
	 *     partir.
	 *
	 * SÍ reutiliza dos piezas ya existentes en vez de reinventarlas:
	 * `trapFocus`/`portal` (`focusTrap.ts`/`portal.ts`, Fase 5) para el
	 * backdrop modal — mismo esqueleto que `Dialog`, incluido el bloqueo
	 * de scroll de fondo y la devolución de foco al cerrar — y el
	 * patrón "saltar deshabilitados con vuelta al principio/final" de
	 * `Tabs.svelte` (Fase 3) para `↓`/`↑` entre opciones.
	 *
	 * A diferencia de `MenuItem` (que NUNCA cierra el menú por sí solo
	 * al seleccionarse — ver `docs/COMPONENTS.md`), seleccionar un
	 * comando aquí SÍ cierra la paleta por defecto (`closeOnSelect`,
	 * `true`) — el propio propósito de una paleta de comandos es "elegir
	 * uno y actuar", no quedarse abierta para seguir explorando, a
	 * diferencia de un menú de navegación persistente.
	 */
	import type { Snippet } from "svelte";
	import { portal } from "../feedback/portal.js";
	import { trapFocus } from "../feedback/focusTrap.js";

	export interface CommandMenuItem {
		id: string;
		label: string;
		/** Encabezado de agrupación visual — items consecutivos con el mismo `group` se muestran juntos bajo un único encabezado. */
		group?: string;
		/** Términos adicionales por los que también debe encontrarse (sinónimos, alias) — no se muestran. */
		keywords?: string[];
		icon?: Snippet;
		shortcut?: string;
		disabled?: boolean;
		onSelect: () => void;
	}

	interface Props {
		open?: boolean;
		items: CommandMenuItem[];
		label?: string;
		placeholder?: string;
		emptyMessage?: string;
		closeOnSelect?: boolean;
		onClose?: () => void;
	}

	let {
		open = $bindable(false),
		items,
		label = "Paleta de comandos",
		placeholder = "Buscar un comando…",
		emptyMessage = "Sin resultados",
		closeOnSelect = true,
		onClose
	}: Props = $props();

	const uid = $props.id();
	const listboxId = `${uid}-command-listbox`;

	let panelEl: HTMLDivElement | undefined = $state();
	let query = $state("");
	let activeIndex = $state(0);

	let filtered = $derived.by(() => {
		const q = query.trim().toLowerCase();
		if (!q) return items;
		return items.filter((item) => item.label.toLowerCase().includes(q) || item.keywords?.some((k) => k.toLowerCase().includes(q)));
	});

	// El índice activo se recalcula al primer item NO deshabilitado cada
	// vez que cambia el filtrado (incluida la apertura) — igual que
	// `Tabs` nunca deja el foco inicial en un item deshabilitado.
	$effect(() => {
		filtered;
		activeIndex = filtered.findIndex((item) => !item.disabled);
	});

	function optionId(item: CommandMenuItem) {
		return `${uid}-option-${item.id}`;
	}

	function activeOptionId(): string | undefined {
		const item = filtered[activeIndex];
		return item ? optionId(item) : undefined;
	}

	function requestClose() {
		if (!open) return;
		open = false;
		query = "";
		onClose?.();
	}

	function select(item: CommandMenuItem) {
		if (item.disabled) return;
		item.onSelect();
		if (closeOnSelect) requestClose();
	}

	// Mismo patrón "saltar deshabilitados, con vuelta al principio/final"
	// que `Tabs.svelte` (Fase 3) — ver su cabecera para el porqué.
	function activeableIndex(from: number, direction: 1 | -1): number {
		let next = from;
		for (let tries = 0; tries < filtered.length; tries++) {
			next = (next + direction + filtered.length) % filtered.length;
			if (!filtered[next]?.disabled) return next;
		}
		return from;
	}

	function onInputKeydown(e: KeyboardEvent) {
		if (filtered.length === 0) return;
		if (e.key === "ArrowDown") {
			e.preventDefault();
			activeIndex = activeableIndex(activeIndex, 1);
		} else if (e.key === "ArrowUp") {
			e.preventDefault();
			activeIndex = activeableIndex(activeIndex, -1);
		} else if (e.key === "Enter") {
			e.preventDefault();
			const item = filtered[activeIndex];
			if (item) select(item);
		}
	}

	$effect(() => {
		if (!open || !panelEl) return;
		return trapFocus(panelEl, { onEscape: requestClose });
	});
</script>

{#if open}
	<div class="gg-command-menu-backdrop bc-anim-scrim" role="presentation" use:portal>
		<div bind:this={panelEl} class="gg-command-menu bc-glass bc-glass--immersive bc-anim-pop" role="dialog" aria-modal="true" aria-label={label} tabindex="-1">
			<input
				type="text"
				class="gg-command-menu__input"
				role="combobox"
				aria-expanded="true"
				aria-controls={listboxId}
				aria-activedescendant={activeOptionId()}
				aria-autocomplete="list"
				autocomplete="off"
				{placeholder}
				bind:value={query}
				onkeydown={onInputKeydown}
			/>
			<div class="gg-command-menu__body">
				{#if filtered.length === 0}
					<p class="gg-command-menu__empty">{emptyMessage}</p>
				{:else}
					<div id={listboxId} role="listbox" aria-label={label} class="gg-command-menu__list">
						{#each filtered as item, index (item.id)}
							{#if item.group && (index === 0 || filtered[index - 1]?.group !== item.group)}
								<p class="gg-command-menu__group-heading">{item.group}</p>
							{/if}
							<!--
								tabindex="-1": esta opción NUNCA recibe el foco real de
								teclado (eso se queda en el <input>, patrón
								aria-activedescendant — ver la cabecera del componente),
								así que no entra en el orden de tabulación; el valor
								satisface igualmente la regla de accesibilidad que exige
								un tabindex explícito en un rol interactivo. onkeydown
								es defensivo por el mismo motivo: la selección por
								teclado normal ya pasa por Enter en el <input>, esto
								solo cubre el caso (infrecuente) de que algo mueva el
								foco real aquí dentro.
							-->
							<div
								id={optionId(item)}
								role="option"
								tabindex="-1"
								aria-selected={index === activeIndex}
								aria-disabled={item.disabled}
								class="gg-command-menu__option"
								class:gg-command-menu__option--active={index === activeIndex}
								class:gg-command-menu__option--disabled={item.disabled}
								onmouseenter={() => (activeIndex = index)}
								onclick={() => select(item)}
								onkeydown={(e) => {
									if (e.key === "Enter") select(item);
								}}
							>
								{#if item.icon}<span class="gg-command-menu__option-icon" aria-hidden="true">{@render item.icon()}</span>{/if}
								<span class="gg-command-menu__option-label">{item.label}</span>
								{#if item.shortcut}<span class="gg-command-menu__option-shortcut">{item.shortcut}</span>{/if}
							</div>
						{/each}
					</div>
				{/if}
			</div>
		</div>
	</div>
{/if}

<style>
	.gg-command-menu-backdrop {
		position: fixed;
		inset: 0;
		z-index: var(--z-modal);
		display: flex;
		align-items: flex-start;
		justify-content: center;
		padding: var(--space-16) var(--space-4) var(--space-4);
		background: var(--overlay-backdrop);
	}

	.gg-command-menu {
		box-sizing: border-box;
		display: flex;
		flex-direction: column;
		width: 100%;
		max-width: var(--overlay-width-md);
		max-height: calc(100vh - var(--space-32));
		/* v1.9.0 — material de cristal (appearance.css): tinte y sombra como variables. */
		--bc-glass-tint: var(--surface-overlay);
		border-radius: var(--radius-xl);
		--bc-glass-shadow: var(--shadow-modal);
		border: 1px solid var(--border);
		overflow: hidden;
	}

	.gg-command-menu__input {
		box-sizing: border-box;
		width: 100%;
		padding: var(--space-4) var(--space-5);
		border: none;
		border-bottom: 1px solid var(--border-subtle);
		border-radius: 0;
		background: transparent;
		color: var(--text-primary);
		font-family: var(--font-sans);
		font-size: var(--text-body-size);
		line-height: var(--text-body-leading);
	}

	.gg-command-menu__input:focus {
		outline: none;
	}

	.gg-command-menu__input::placeholder {
		color: var(--text-muted);
	}

	.gg-command-menu__body {
		overflow-y: auto;
		padding: var(--space-2);
	}

	.gg-command-menu__empty {
		margin: 0;
		padding: var(--space-6) var(--space-3);
		color: var(--text-muted);
		text-align: center;
		font-family: var(--font-sans);
		font-size: var(--text-body-sm-size);
		line-height: var(--text-body-sm-leading);
	}

	.gg-command-menu__list {
		display: flex;
		flex-direction: column;
		gap: var(--space-1);
	}

	.gg-command-menu__group-heading {
		margin: 0;
		padding: var(--space-2) var(--space-3) var(--space-1);
		color: var(--text-muted);
		font-family: var(--font-sans);
		font-size: var(--text-overline-size);
		font-weight: var(--text-overline-weight);
		line-height: var(--text-overline-leading);
		text-transform: uppercase;
	}

	.gg-command-menu__option {
		box-sizing: border-box;
		display: flex;
		align-items: center;
		gap: var(--space-2);
		width: 100%;
		padding: var(--space-2) var(--space-3);
		border-radius: var(--radius-sm);
		color: var(--text-primary);
		font-family: var(--font-sans);
		font-size: var(--text-body-sm-size);
		line-height: var(--text-body-sm-leading);
		cursor: pointer;
	}

	.gg-command-menu__option--active {
		background: var(--surface-sunken);
	}

	.gg-command-menu__option--disabled {
		color: var(--text-disabled);
		cursor: not-allowed;
	}

	.gg-command-menu__option-icon {
		display: inline-flex;
		flex-shrink: 0;
		width: var(--space-4);
		height: var(--space-4);
	}

	.gg-command-menu__option-label {
		flex: 1;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.gg-command-menu__option-shortcut {
		flex-shrink: 0;
		color: var(--text-muted);
		font-size: var(--text-caption-size);
	}
</style>
