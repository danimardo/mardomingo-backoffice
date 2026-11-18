<script lang="ts">
	/**
	 * RequiredIndicator (§15) — el asterisco de "obligatorio", con texto
	 * oculto para lector de pantalla en vez de depender solo del símbolo
	 * visual (§63: no depender solo del color/símbolo para transmitir
	 * información).
	 *
	 * El asterisco usa `--text-danger`, no `--status-danger`: aunque
	 * lleva `aria-hidden` (el texto accesible real es el `sr-text` de
	 * al lado), sigue siendo un glifo de TEXTO presentado visualmente —
	 * `aria-hidden` lo saca del árbol de accesibilidad, no del umbral de
	 * contraste de texto de WCAG 1.4.3, que sigue aplicando para quien
	 * SÍ lo ve. Un campo obligatorio puede estar dentro de una Card
	 * tan fácilmente como suelto — mismo motivo que `Button`
	 * `variant="danger"` (ver docs/TOKENS.md, "post-ampliación 3").
	 */
</script>

<span class="gg-required" aria-hidden="true">*</span>
<span class="gg-required__sr-text">(obligatorio)</span>

<style>
	.gg-required {
		color: var(--text-danger);
		margin-inline-start: var(--space-1);
	}

	.gg-required__sr-text {
		position: absolute;
		width: 1px;
		height: 1px;
		overflow: hidden;
		clip: rect(0 0 0 0);
		white-space: nowrap;
	}
</style>
