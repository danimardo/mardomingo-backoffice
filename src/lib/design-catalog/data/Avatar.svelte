<script lang="ts">
	/**
	 * Avatar — imagen de perfil o iniciales de respaldo (candidato #2 de
	 * la ronda de ampliación post-v0.13.0, ver docs/ROADMAP.md). `src`
	 * ausente, vacío o que falla al cargar (`onerror`) cae a iniciales —
	 * nunca a un icono genérico de persona ni a un hueco vacío, para que
	 * siempre haya algo identificable incluso sin foto.
	 *
	 * Tamaños tokenizados (`--space-*`), mismo criterio que
	 * `controlBoxSize` de `forms/types.ts` pero con su propia escala
	 * (xs-xl) porque un avatar cubre un rango de tamaño mayor que un
	 * control de formulario (de un icono en una fila de tabla a una
	 * cabecera de perfil).
	 *
	 * El punto de presencia reutiliza el vocabulario de tono de
	 * `DataCardStatus`/`Chip`/`Badge` (success=en línea, warning=ausente,
	 * danger=ocupado, neutral=desconectado) — información NO textual
	 * (WCAG 1.4.11, ≥3:1), igual que el punto de `DataCardStatus`, así
	 * que usa `--status-X` directamente sin volver a medir contraste.
	 * Lleva además un `aria-label` en el propio `<Avatar>` (vía `status`
	 * + `name`) para que la presencia no dependa solo del color.
	 */
	const SIZES = {
		xs: "var(--space-5)",
		sm: "var(--space-6)",
		md: "var(--space-8)",
		lg: "var(--space-10)",
		xl: "var(--space-12)"
	} as const;

	const FONT_SIZES: Record<keyof typeof SIZES, string> = {
		xs: "var(--text-caption-size)",
		sm: "var(--text-caption-size)",
		md: "var(--text-body-sm-size)",
		lg: "var(--text-body-size)",
		xl: "var(--text-body-lg-size)"
	};

	interface Props {
		src?: string;
		/** Texto accesible y origen de las iniciales de respaldo — nombre completo (p. ej. "Marta Ruiz"). */
		name: string;
		size?: keyof typeof SIZES;
		status?: "online" | "away" | "busy" | "offline";
		class?: string;
	}

	let { src, name, size = "md", status, class: className = "" }: Props = $props();

	let loadFailed = $state(false);
	$effect(() => {
		// Si cambia `src` (p. ej. tras recargar el perfil), vuelve a intentar la imagen nueva.
		src;
		loadFailed = false;
	});

	function initials(full: string): string {
		const parts = full.trim().split(/\s+/).filter(Boolean);
		if (parts.length === 0) return "?";
		const first = parts[0] ?? "";
		if (parts.length === 1) return first.slice(0, 2).toUpperCase();
		const last = parts[parts.length - 1] ?? "";
		return (first.charAt(0) + last.charAt(0)).toUpperCase();
	}

	const STATUS_LABEL: Record<NonNullable<Props["status"]>, string> = {
		online: "en línea",
		away: "ausente",
		busy: "ocupado",
		offline: "desconectado"
	};

	let dim = $derived(SIZES[size]);
	let fontSize = $derived(FONT_SIZES[size]);
	let showImage = $derived(!!src && !loadFailed);
	let a11yLabel = $derived(status ? `${name} (${STATUS_LABEL[status]})` : name);
</script>

<span class="gg-avatar {className}" style={`width:${dim};height:${dim};`} role="img" aria-label={a11yLabel}>
	{#if showImage}
		<img class="gg-avatar__img" {src} alt="" onerror={() => (loadFailed = true)} />
	{:else}
		<span class="gg-avatar__initials" style={`font-size:${fontSize};`} aria-hidden="true">{initials(name)}</span>
	{/if}
	{#if status}
		<span class="gg-avatar__status gg-avatar__status--{status}" aria-hidden="true"></span>
	{/if}
</span>

<style>
	.gg-avatar {
		position: relative;
		box-sizing: border-box;
		display: inline-flex;
		flex-shrink: 0;
		align-items: center;
		justify-content: center;
		border-radius: var(--radius-full);
		background: var(--surface-sunken);
		overflow: hidden;
	}

	.gg-avatar__img {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}

	.gg-avatar__initials {
		font-family: var(--font-sans);
		font-weight: var(--text-label-weight);
		color: var(--text-secondary);
		line-height: 1;
	}

	.gg-avatar__status {
		position: absolute;
		right: 0;
		bottom: 0;
		width: 28%;
		height: 28%;
		min-width: var(--space-2);
		min-height: var(--space-2);
		border-radius: var(--radius-full);
		border: 2px solid var(--surface);
	}

	.gg-avatar__status--online {
		background: var(--status-success);
	}

	.gg-avatar__status--away {
		background: var(--status-warning);
	}

	.gg-avatar__status--busy {
		background: var(--status-danger);
	}

	.gg-avatar__status--offline {
		background: var(--text-disabled);
	}
</style>
