<script lang="ts">
	/**
	 * AccordionItem — una sección de `Accordion` (ver ese fichero para el
	 * contexto completo). Cabecera en `<h3>` + `<button>` (nivel de
	 * encabezado fijo por simplicidad — si un consumidor necesita otro
	 * nivel, puede envolver `Accordion` en su propio `<div
	 * role="heading" aria-level>`; no se expone como prop porque ningún
	 * otro componente del catálogo lo necesita todavía, mismo criterio
	 * de no añadir superficie de API sin un caso real que lo pida).
	 * Panel con `role="region"` + `aria-labelledby` (patrón ARIA
	 * "Accordion" completo).
	 */
	import { getContext } from "svelte";
	import type { Snippet } from "svelte";
	import { Icon } from "../icons/index.js";
	import { ExpandCollapse } from "../motion/index.js";
	import type { AccordionContext } from "./Accordion.svelte";

	interface Props {
		value: string;
		title: string;
		disabled?: boolean;
		children: Snippet;
		class?: string;
	}

	let { value, title, disabled = false, children, class: className = "" }: Props = $props();

	const ctx = getContext<AccordionContext>("gg-accordion");

	// `use:` en vez de `bind:this` + `$effect`: registrar/desregistrar es
	// puro ciclo de vida imperativo del DOM (montar/desmontar), no algo
	// que deba reaccionar a ningún estado — hacerlo con `$effect` creaba
	// un bucle de actualización (`effect_update_depth_exceeded`) al
	// mutar el `order`/`refs` del padre (`Accordion`) desde dentro del
	// efecto de un hijo. Una `action` evita el problema de raíz: se
	// ejecuta una vez al montar, sin entrar en el grafo de dependencias
	// reactivas de Svelte en absoluto.
	function registerTrigger(node: HTMLButtonElement) {
		ctx.register(value, node);
		return {
			destroy() {
				ctx.unregister(value);
			}
		};
	}

	let headerId = $derived(`${ctx.uid}-acc-h-${value}`);
	let panelId = $derived(`${ctx.uid}-acc-p-${value}`);
	let open = $derived(ctx.isOpen(value));

	function onKeydown(e: KeyboardEvent) {
		if (e.key === "ArrowDown") {
			e.preventDefault();
			ctx.moveFocus(value, 1);
		} else if (e.key === "ArrowUp") {
			e.preventDefault();
			ctx.moveFocus(value, -1);
		} else if (e.key === "Home") {
			e.preventDefault();
			ctx.focusFirst();
		} else if (e.key === "End") {
			e.preventDefault();
			ctx.focusLast();
		}
	}
</script>

<div class="gg-accordion-item {className}">
	<h3 class="gg-accordion-item__heading">
		<button
			type="button"
			id={headerId}
			use:registerTrigger
			class="gg-accordion-item__trigger"
			aria-expanded={open}
			aria-controls={panelId}
			{disabled}
			onclick={() => ctx.toggle(value)}
			onkeydown={onKeydown}
		>
			<Icon
				name="chevron-down"
				class={["gg-accordion-item__chevron", open ? "gg-accordion-item__chevron--open" : ""].filter(Boolean).join(" ")}
				size="1em"
				legacySvg={{
					viewBox: "0 0 16 16",
					fill: "none",
					stroke: "currentColor",
					strokeWidth: "1.8",
					body: '<path d="M4 6l4 4 4-4" />'
				}}
			/>
			<span class="gg-accordion-item__title">{title}</span>
		</button>
	</h3>
	<ExpandCollapse expanded={open}>
		<div id={panelId} role="region" aria-labelledby={headerId} class="gg-accordion-item__panel">
			{@render children()}
		</div>
	</ExpandCollapse>
</div>

<style>
	.gg-accordion-item {
		border-bottom: 1px solid var(--border-subtle);
	}

	.gg-accordion-item__heading {
		margin: 0;
		font-size: inherit;
		font-weight: inherit;
	}

	.gg-accordion-item__trigger {
		appearance: none;
		display: flex;
		align-items: center;
		gap: var(--space-2);
		width: 100%;
		border: none;
		background: transparent;
		padding: var(--space-3) var(--space-1);
		color: var(--text-primary);
		font-family: var(--font-sans);
		font-size: var(--text-body-size);
		font-weight: var(--text-label-weight);
		text-align: start;
		cursor: pointer;
	}

	.gg-accordion-item__trigger:hover:not(:disabled) {
		color: var(--text-interactive);
	}

	.gg-accordion-item__trigger:disabled {
		color: var(--text-disabled);
		cursor: not-allowed;
	}

	.gg-accordion-item__trigger:focus-visible {
		outline: 2px solid var(--focus);
		outline-offset: -2px;
	}

	:global(.gg-accordion-item__chevron) {
		flex-shrink: 0;
		color: var(--text-muted);
		transition: transform var(--duration-fast) var(--easing-standard);
	}

	:global(.gg-accordion-item__chevron--open) {
		transform: rotate(180deg);
	}

	.gg-accordion-item__panel {
		padding: 0 var(--space-1) var(--space-4);
		color: var(--text-secondary);
		font-family: var(--font-sans);
		font-size: var(--text-body-sm-size);
		line-height: var(--text-body-sm-leading);
	}

	@media (prefers-reduced-motion: reduce) {
		:global(.gg-accordion-item__chevron) {
			transition: none;
		}
	}
</style>
