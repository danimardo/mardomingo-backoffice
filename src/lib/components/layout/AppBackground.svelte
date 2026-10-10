<script lang="ts">
	// Fondo ambiental: solo decorativo, oculto para las tecnologías de apoyo. Los degradados son tokens (tokens.css).
</script>

<div class="ambient" aria-hidden="true">
	<span class="blob blob-1"></span>
	<span class="blob blob-2"></span>
</div>

<style>
	.ambient {
		position: fixed;
		inset: 0;
		z-index: -1;
		overflow: hidden;
		background: var(--gradient-app-bg);
		pointer-events: none;
	}

	.blob {
		position: absolute;
		border-radius: 50%;
		filter: blur(var(--blur-hero));
	}

	.blob-1 {
		width: 42rem;
		height: 42rem;
		right: -12rem;
		top: -14rem;
		background: var(--gradient-blob-1);
		opacity: var(--blob-1-opacity);
	}

	.blob-2 {
		width: 36rem;
		height: 36rem;
		left: -10rem;
		bottom: -16rem;
		background: var(--gradient-blob-2);
		box-shadow: var(--shadow-blob-2);
		opacity: var(--blob-2-opacity);
	}
</style>
