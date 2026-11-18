<script lang="ts">
	/**
	 * InteractiveMascot (v1.11.0) — asistente vectorial interactivo ("BeBot")
	 * con máquina de estados al estilo Rive (idle / typing / password / peek /
	 * success / error), implementado en SVG + Svelte 5 + tokens CSS sin
	 * runtime WebAssembly externo.
	 *
	 * - Sigue el puntero (`trackPointer`) o las coordenadas declarativas
	 *   `lookX`/`lookY` (-1 a 1, p. ej. según la longitud del texto escrito).
	 * - En `state="password"` sube las manos con física de muelle
	 *   (`--easing-spring`) para taparse los ojos; en `state="peek"`
	 *   (mostrar contraseña) baja ligeramente una mano y mira con un ojo.
	 * - En `state="success"` y `state="error"` cambia expresión, color de
	 *   antena (segundo canal + forma) y ejecuta una animación de feedback.
	 * - Respeta `prefers-reduced-motion: reduce` y `data-effects="off"`.
	 */
	import { prefersReducedMotion } from "../motion/tokens.js";

	export type MascotState = "idle" | "typing" | "password" | "peek" | "success" | "error";
	export type MascotSize = "sm" | "md" | "lg";

	interface Props {
		/** Estado actual de la máquina de estados de la mascota. */
		state?: MascotState;
		/** Mirada horizontal declarativa (-1 izquierda a 1 derecha). */
		lookX?: number;
		/** Mirada vertical declarativa (-1 arriba a 1 abajo). */
		lookY?: number;
		/** Si es `true`, sigue el puntero del ratón cuando está en `idle`. */
		trackPointer?: boolean;
		/** Tamaño del lienzo tokenizado: sm (--space-16), md (--space-24), lg (--space-32). */
		size?: MascotSize;
		/** Nombre accesible si la ilustración aporta significado propio; si se omite, es decorativa (`aria-hidden="true"`). */
		label?: string;
		class?: string;
	}

	const SIZE_VAR: Record<MascotSize, string> = {
		sm: "var(--space-16)",
		md: "var(--space-24)",
		lg: "var(--space-32)"
	};

	let {
		state: mascotState = "idle",
		lookX = 0,
		lookY = 0,
		trackPointer = true,
		size = "md",
		label,
		class: className = ""
	}: Props = $props();

	let rootEl: HTMLDivElement | undefined = $state();
	let pointerX = $state(0);
	let pointerY = $state(0);
	let hasPointer = $state(false);

	function clampUnit(n: number): number {
		return Math.max(-1, Math.min(1, Number.isFinite(n) ? n : 0));
	}

	$effect(() => {
		if (!trackPointer || mascotState !== "idle" || typeof window === "undefined") {
			hasPointer = false;
			return;
		}

		function onPointerMove(e: PointerEvent) {
			if (!rootEl || prefersReducedMotion() || document.documentElement.dataset.effects === "off") {
				hasPointer = false;
				return;
			}
			const rect = rootEl.getBoundingClientRect();
			const cx = rect.left + rect.width / 2;
			const cy = rect.top + rect.height / 2;
			const dx = e.clientX - cx;
			const dy = e.clientY - cy;
			const radius = Math.max(rect.width * 2.5, 160);
			pointerX = clampUnit(dx / radius);
			pointerY = clampUnit(dy / radius);
			hasPointer = true;
		}

		window.addEventListener("pointermove", onPointerMove, { passive: true });
		return () => window.removeEventListener("pointermove", onPointerMove);
	});

	let resolvedX = $derived.by(() => {
		if (mascotState === "password" || mascotState === "success" || mascotState === "error") return 0;
		if (mascotState === "peek") return 0.35;
		if (mascotState === "typing") return clampUnit(lookX);
		return hasPointer ? pointerX : clampUnit(lookX);
	});

	let resolvedY = $derived.by(() => {
		if (mascotState === "password" || mascotState === "success" || mascotState === "error") return 0;
		if (mascotState === "peek") return 0.25;
		if (mascotState === "typing") return clampUnit(lookY !== 0 ? lookY : 0.55);
		return hasPointer ? pointerY : clampUnit(lookY);
	});

	let inlineVars = $derived(
		`--gg-mascot-size:${SIZE_VAR[size]};` +
			`--gg-mascot-x:${resolvedX.toFixed(3)};` +
			`--gg-mascot-y:${resolvedY.toFixed(3)};`
	);
</script>

<div
	bind:this={rootEl}
	class="gg-mascot gg-mascot--{mascotState} {className}"
	class:bc-anim-shake={mascotState === "error"}
	style={inlineVars}
	data-mascot-state={mascotState}
>
	<svg
		class="gg-mascot__svg"
		viewBox="0 0 120 120"
		fill="none"
		role={label ? "img" : undefined}
		aria-label={label}
		aria-hidden={label ? undefined : "true"}
	>
		<!-- Sombra de apoyo -->
		<ellipse class="gg-mascot__shadow" cx="60" cy="108" rx="28" ry="5" />

		<!-- Grupo de cabeza + auriculares BeCall (se inclina suavemente con la mirada) -->
		<g class="gg-mascot__head">
			<!-- Antena superior -->
			<line class="gg-mascot__antenna-stem" x1="60" y1="26" x2="60" y2="14" stroke-width="3" stroke-linecap="round" />
			<circle class="gg-mascot__antenna-bulb" cx="60" cy="11" r="5.5" />

			<!-- Diadema / auriculares laterales de contact center -->
			<rect class="gg-mascot__ear" x="14" y="48" width="9" height="22" rx="4.5" />
			<rect class="gg-mascot__ear" x="97" y="48" width="9" height="22" rx="4.5" />

			<!-- Casco principal redondeado -->
			<rect class="gg-mascot__shell" x="20" y="24" width="80" height="68" rx="28" stroke-width="2" />
			<!-- Reflejo superior estilo cristal -->
			<path
				class="gg-mascot__sheen"
				d="M36 30h48"
				stroke-width="2.5"
				stroke-linecap="round"
			/>

			<!-- Pantalla facial interior -->
			<rect class="gg-mascot__visor" x="28" y="36" width="64" height="44" rx="18" stroke-width="1.5" />

			<!-- Cara (ojos, cejas y boca) con paralaje más pronunciado -->
			<g class="gg-mascot__face">
				<!-- Cejas -->
				<path class="gg-mascot__brow gg-mascot__brow--left" d="M39 46 Q45 43 51 46" stroke-width="2.2" stroke-linecap="round" />
				<path class="gg-mascot__brow gg-mascot__brow--right" d="M69 46 Q75 43 81 46" stroke-width="2.2" stroke-linecap="round" />

				{#if mascotState === "success"}
					<!-- Ojos felices (^ ^) -->
					<path class="gg-mascot__eye-happy" d="M39 56 Q45 49 51 56" stroke-width="2.8" stroke-linecap="round" />
					<path class="gg-mascot__eye-happy" d="M69 56 Q75 49 81 56" stroke-width="2.8" stroke-linecap="round" />
				{:else}
					<!-- Ojos estándar con parpadeo y pupilas móviles -->
					<g class="gg-mascot__eyes">
						<g class="gg-mascot__eye gg-mascot__eye--left">
							<circle class="gg-mascot__sclera" cx="45" cy="55" r="7" />
							<circle class="gg-mascot__pupil" cx="45" cy="55" r="3.6" />
							<circle class="gg-mascot__glint" cx="43.5" cy="53.5" r="1.3" />
						</g>
						<g class="gg-mascot__eye gg-mascot__eye--right">
							<circle class="gg-mascot__sclera" cx="75" cy="55" r="7" />
							<circle class="gg-mascot__pupil" cx="75" cy="55" r="3.6" />
							<circle class="gg-mascot__glint" cx="73.5" cy="53.5" r="1.3" />
						</g>
					</g>
				{/if}

				<!-- Boca según estado -->
				{#if mascotState === "success"}
					<path class="gg-mascot__mouth gg-mascot__mouth--success" d="M49 67 Q60 76 71 67" stroke-width="2.6" stroke-linecap="round" />
				{:else if mascotState === "error"}
					<path class="gg-mascot__mouth gg-mascot__mouth--error" d="M51 71 Q60 64 69 71" stroke-width="2.6" stroke-linecap="round" />
				{:else if mascotState === "password" || mascotState === "peek"}
					<circle class="gg-mascot__mouth-o" cx="60" cy="69" r="3" />
				{:else}
					<path class="gg-mascot__mouth" d="M53 68 Q60 73 67 68" stroke-width="2.4" stroke-linecap="round" />
				{/if}
			</g>

			<!-- Micrófono de diadema BeCall -->
			<path class="gg-mascot__mic-boom" d="M20 64 Q26 78 44 79" stroke-width="2.2" stroke-linecap="round" />
			<circle class="gg-mascot__mic-tip" cx="46" cy="79" r="3" />
		</g>

		<!-- Manos flotantes (suben a tapar los ojos en password y se entreabren en peek) -->
		<g class="gg-mascot__hands">
			<g class="gg-mascot__hand gg-mascot__hand--left">
				<rect x="20" y="84" width="22" height="16" rx="8" stroke-width="1.8" />
				<line x1="27" y1="88" x2="27" y2="93" stroke-width="1.6" stroke-linecap="round" />
				<line x1="34" y1="88" x2="34" y2="93" stroke-width="1.6" stroke-linecap="round" />
			</g>
			<g class="gg-mascot__hand gg-mascot__hand--right">
				<rect x="78" y="84" width="22" height="16" rx="8" stroke-width="1.8" />
				<line x1="86" y1="88" x2="86" y2="93" stroke-width="1.6" stroke-linecap="round" />
				<line x1="93" y1="88" x2="93" y2="93" stroke-width="1.6" stroke-linecap="round" />
			</g>
		</g>
	</svg>
</div>

<style>
	.gg-mascot {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: var(--gg-mascot-size, var(--space-24));
		height: var(--gg-mascot-size, var(--space-24));
		user-select: none;
		flex-shrink: 0;
	}

	.gg-mascot__svg {
		width: 100%;
		height: 100%;
		overflow: visible;
	}

	.gg-mascot__shadow {
		fill: color-mix(in srgb, var(--text-primary) 14%, transparent);
		transform-origin: 50% 90%;
		transition: transform var(--duration-normal) var(--easing-standard);
	}

	.gg-mascot__head {
		transform: translate(
			calc(var(--gg-mascot-x, 0) * var(--space-1)),
			calc(var(--gg-mascot-y, 0) * var(--space-1))
		);
		transition: transform var(--duration-normal) var(--easing-spring);
	}

	.gg-mascot--success .gg-mascot__head {
		transform: translateY(calc(var(--space-1) * -1));
	}

	.gg-mascot__antenna-stem {
		stroke: var(--primary-500);
	}

	.gg-mascot__antenna-bulb {
		fill: var(--accent-500);
		stroke: var(--surface-raised);
		stroke-width: 1.5;
		transition:
			fill var(--duration-fast) var(--easing-standard),
			transform var(--duration-normal) var(--easing-spring);
		transform-origin: 50% 10%;
	}

	.gg-mascot--success .gg-mascot__antenna-bulb {
		fill: var(--status-success);
		transform: scale(var(--motion-icon-pop-scale));
	}

	.gg-mascot--error .gg-mascot__antenna-bulb {
		fill: var(--status-danger);
		transform: scale(var(--motion-icon-pop-scale));
	}

	.gg-mascot__ear {
		fill: var(--accent-500);
	}

	.gg-mascot__shell {
		fill: var(--primary-500);
		stroke: var(--primary-700);
	}

	.gg-mascot__sheen {
		stroke: color-mix(in srgb, var(--color-white) 55%, transparent);
	}

	.gg-mascot__visor {
		fill: var(--surface-raised);
		stroke: var(--border-strong);
	}

	.gg-mascot__face {
		transform: translate(
			calc(var(--gg-mascot-x, 0) * var(--space-1)),
			calc(var(--gg-mascot-y, 0) * var(--space-1))
		);
		transition: transform var(--duration-fast) var(--easing-standard);
	}

	.gg-mascot__brow {
		stroke: var(--text-secondary);
		transition: transform var(--duration-normal) var(--easing-spring);
		transform-box: fill-box;
		transform-origin: center;
	}

	.gg-mascot--error .gg-mascot__brow--left {
		transform: rotate(14deg) translateY(calc(var(--space-1) * 0.5));
	}

	.gg-mascot--error .gg-mascot__brow--right {
		transform: rotate(-14deg) translateY(calc(var(--space-1) * 0.5));
	}

	.gg-mascot--typing .gg-mascot__brow {
		transform: translateY(calc(var(--space-1) * -0.4));
	}

	.gg-mascot__eyes {
		transform-box: fill-box;
		transform-origin: center;
		animation: gg-mascot-blink 4.5s infinite;
	}

	.gg-mascot__eye {
		transform-box: fill-box;
		transform-origin: center;
		transition: transform var(--duration-fast) var(--easing-standard);
	}

	.gg-mascot--password .gg-mascot__eye--left,
	.gg-mascot--password .gg-mascot__eye--right,
	.gg-mascot--peek .gg-mascot__eye--left {
		transform: scaleY(0.2);
	}

	.gg-mascot__sclera {
		fill: var(--surface-sunken);
		stroke: var(--border);
		stroke-width: 1;
	}

	.gg-mascot__pupil {
		fill: var(--text-primary);
		transform: translate(
			calc(var(--gg-mascot-x, 0) * var(--space-1) * 0.65),
			calc(var(--gg-mascot-y, 0) * var(--space-1) * 0.65)
		);
		transition: transform var(--duration-fast) var(--easing-standard);
	}

	.gg-mascot__glint {
		fill: var(--color-white);
		transform: translate(
			calc(var(--gg-mascot-x, 0) * var(--space-1) * 0.65),
			calc(var(--gg-mascot-y, 0) * var(--space-1) * 0.65)
		);
		transition: transform var(--duration-fast) var(--easing-standard);
	}

	.gg-mascot__eye-happy {
		stroke: var(--status-success);
	}

	.gg-mascot__mouth {
		stroke: var(--text-primary);
	}

	.gg-mascot__mouth--success {
		stroke: var(--status-success);
	}

	.gg-mascot__mouth--error {
		stroke: var(--status-danger);
	}

	.gg-mascot__mouth-o {
		fill: var(--text-primary);
	}

	.gg-mascot__mic-boom {
		stroke: var(--secondary-700);
	}

	.gg-mascot__mic-tip {
		fill: var(--accent-500);
	}

	.gg-mascot__hand {
		fill: var(--primary-600);
		stroke: var(--surface-raised);
		transform-box: fill-box;
		transform-origin: center;
		transition: transform var(--duration-normal) var(--easing-spring);
	}

	/* Estado password: ambas manos suben a cubrir los ojos. */
	.gg-mascot--password .gg-mascot__hand--left,
	.gg-mascot--peek .gg-mascot__hand--left {
		transform: translate(var(--space-3), calc(var(--space-8) * -1.15)) rotate(18deg);
	}

	.gg-mascot--password .gg-mascot__hand--right {
		transform: translate(calc(var(--space-3) * -1), calc(var(--space-8) * -1.15)) rotate(-18deg);
	}

	/* Estado peek (mostrar contraseña): la mano derecha baja ligeramente para espiar con un ojo. */
	.gg-mascot--peek .gg-mascot__hand--right {
		transform: translate(calc(var(--space-1) * -1), calc(var(--space-5) * -1)) rotate(-8deg);
	}

	/* Estado success: manos arriba celebrando. */
	.gg-mascot--success .gg-mascot__hand--left {
		transform: translate(calc(var(--space-1) * -1), calc(var(--space-3) * -1)) rotate(-14deg);
	}

	.gg-mascot--success .gg-mascot__hand--right {
		transform: translate(var(--space-1), calc(var(--space-3) * -1)) rotate(14deg);
	}

	@keyframes gg-mascot-blink {
		0%,
		94%,
		98%,
		100% {
			transform: scaleY(1);
		}
		96% {
			transform: scaleY(0.1);
		}
	}

	:global(:root[data-effects="off"]) .gg-mascot__eyes {
		animation: none;
	}

	:global(:root[data-effects="off"]) .gg-mascot__head,
	:global(:root[data-effects="off"]) .gg-mascot__face,
	:global(:root[data-effects="off"]) .gg-mascot__pupil,
	:global(:root[data-effects="off"]) .gg-mascot__glint,
	:global(:root[data-effects="off"]) .gg-mascot__hand,
	:global(:root[data-effects="off"]) .gg-mascot__brow,
	:global(:root[data-effects="off"]) .gg-mascot__antenna-bulb {
		transition: none;
	}

	@media (prefers-reduced-motion: reduce) {
		.gg-mascot__eyes {
			animation: none;
		}

		.gg-mascot__head,
		.gg-mascot__face,
		.gg-mascot__pupil,
		.gg-mascot__glint,
		.gg-mascot__hand,
		.gg-mascot__brow,
		.gg-mascot__antenna-bulb,
		.gg-mascot__shadow {
			transition: none;
		}
	}
</style>
