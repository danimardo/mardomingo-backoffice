/** Preferencias efectivas, incluida una sección con efectos desactivados. */
export function motionAllowed(node: HTMLElement): boolean {
	return !window.matchMedia("(prefers-reduced-motion: reduce)").matches &&
		node.closest("[data-effects]")?.getAttribute("data-effects") !== "off";
}

/** Detiene también una animación en curso cuando cambia la preferencia. */
export function observeMotionPreference(node: HTMLElement, changed: () => void) {
	const media = window.matchMedia("(prefers-reduced-motion: reduce)");
	media.addEventListener("change", changed);
	const observer = new MutationObserver(changed);
	for (let ancestor: HTMLElement | null = node; ancestor; ancestor = ancestor.parentElement) {
		observer.observe(ancestor, { attributes: true, attributeFilter: ["data-effects"] });
	}
	return () => {
		media.removeEventListener("change", changed);
		observer.disconnect();
	};
}
