/**
 * `trapFocus(root, options)` — el núcleo de accesibilidad que comparten
 * `Dialog` y `Modal` (§26): factorizado en un fichero propio, sin runes
 * (no hace falta estado reactivo, solo efectos secundarios de DOM), para
 * que las dos piezas no dupliquen ~40 líneas de la MISMA lógica —
 * mismo criterio que llevó a que `DataCard` reutilizara
 * `CardHeader`/`CardBody`/`CardFooter` en vez de tener las suyas
 * (Fase 4).
 *
 * Qué hace, y por qué cada parte (patrón WAI-ARIA "Modal Dialog"
 * estándar, no una reinvención):
 *
 * 1. Guarda `document.activeElement` (lo que tenía el foco ANTES de
 *    abrir) para devolvérselo al cerrar — un modal no debe dejar al
 *    usuario de teclado/lector de pantalla "perdido" en el `<body>`.
 * 2. Mueve el foco al primer elemento focusable de `root` al abrir (o a
 *    `root` mismo si no hay ninguno — de ahí que `Dialog`/`Modal` den
 *    `tabindex="-1"` a su contenedor).
 * 3. Atrapa `Tab`/`Shift+Tab`: si el foco está en el ÚLTIMO focusable y
 *    se pulsa Tab, salta al PRIMERO (y viceversa con Shift+Tab) — sin
 *    esto, Tab se escaparía del diálogo hacia el resto de la página que
 *    sigue en el DOM detrás del backdrop (aunque esté tapada
 *    visualmente, `aria-modal="true"` por sí solo NO evita que reciba
 *    foco por teclado en todos los lectores de pantalla/navegadores).
 * 4. Escape cierra (delegado al consumidor vía `onEscape`).
 * 5. Bloquea el scroll del `<body>` mientras está abierto — un modal
 *    tapa el contenido, dejar que la página de detrás siga
 *    desplazándose por debajo es una fuga de la propia idea de "modal".
 *
 * Devuelve una función `release()` que deshace las tres cosas (listener,
 * scroll, foco) — se llama desde el cleanup de un `$effect` en el
 * componente, igual que `DropdownMenu` quita su listener de click fuera.
 */

export interface FocusTrapOptions {
	onEscape?: (() => void) | undefined;
}

const FOCUSABLE_SELECTOR =
	'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

function getFocusable(root: HTMLElement): HTMLElement[] {
	return Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter((el) => el.getClientRects().length > 0);
}

let lockCount = 0;
let originalBodyOverflow = "";
let originalMainOverflow = "";

function lockScroll(): () => void {
	if (typeof document === "undefined") return () => {};
	const appMain = document.querySelector<HTMLElement>(".gg-app-shell__main");
	if (lockCount === 0) {
		originalBodyOverflow = document.body.style.overflow;
		document.body.style.overflow = "hidden";
		if (appMain) {
			originalMainOverflow = appMain.style.overflow;
			if (originalMainOverflow === "hidden") originalMainOverflow = "";
			appMain.style.overflow = "hidden";
		}
	}
	lockCount++;

	return () => {
		lockCount--;
		if (lockCount <= 0) {
			lockCount = 0;
			if (originalBodyOverflow && originalBodyOverflow !== "hidden") {
				document.body.style.overflow = originalBodyOverflow;
			} else {
				document.body.style.removeProperty("overflow");
			}

			if (appMain) {
				if (originalMainOverflow && originalMainOverflow !== "hidden") {
					appMain.style.overflow = originalMainOverflow;
				} else {
					appMain.style.removeProperty("overflow");
				}
			}
		}
	};
}

export function trapFocus(root: HTMLElement, options: FocusTrapOptions = {}): () => void {
	const previouslyFocused = document.activeElement as HTMLElement | null;
	const unlockScroll = lockScroll();

	// `queueMicrotask`: el propio `root` puede seguir sin pintar sus hijos
	// interactivos en el mismo tick en el que se monta — mismo motivo por
	// el que `DropdownMenu` usa `queueMicrotask` antes de `focusFirst()`.
	queueMicrotask(() => {
		(getFocusable(root)[0] ?? root).focus();
	});

	function onKeydown(e: KeyboardEvent) {
		if (e.key === "Escape") {
			if (!options.onEscape) return;
			e.stopPropagation();
			options.onEscape();
			return;
		}
		if (e.key !== "Tab") return;
		const focusable = getFocusable(root);
		if (focusable.length === 0) {
			// Nada focusable dentro (un diálogo de solo texto) — Tab no
			// debe poder salirse igualmente.
			e.preventDefault();
			return;
		}
		const first = focusable[0];
		const last = focusable[focusable.length - 1];
		if (!first || !last) return;
		// v1.10.0: si el foco se ha salido del panel (p. ej. un clic en el
		// fondo lo deja en <body>), Tab lo devuelve dentro en vez de dejarlo
		// recorrer la página de detrás.
		if (!root.contains(document.activeElement)) {
			e.preventDefault();
			(e.shiftKey ? last : first).focus();
			return;
		}
		if (e.shiftKey && document.activeElement === first) {
			e.preventDefault();
			last.focus();
		} else if (!e.shiftKey && document.activeElement === last) {
			e.preventDefault();
			first.focus();
		}
	}

	// Captura (`true`) para interceptar Escape/Tab antes que cualquier
	// otro listener de la página que pudiera hacer `stopPropagation()`.
	document.addEventListener("keydown", onKeydown, true);

	return function release() {
		document.removeEventListener("keydown", onKeydown, true);
		unlockScroll();
		previouslyFocused?.focus();
	};
}
