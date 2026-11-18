/** Geometría compartida por Tabs y SegmentedControl; sin estado reactivo. */
export function slidingIndicator(node: HTMLElement) {
	function sync() {
		const selected = node.querySelector<HTMLElement>('[aria-selected="true"], [aria-checked="true"]');
		const ready = !!selected && selected.offsetWidth > 0;
		node.classList.toggle("gg-indicator-ready", ready);
		if (!selected || !ready) return;
		node.style.setProperty("--gg-indicator-x", `${selected.offsetLeft}px`);
		node.style.setProperty("--gg-indicator-width", `${selected.offsetWidth}px`);
	}
	const resize = new ResizeObserver(sync);
	function observeChildren() {
		resize.disconnect();
		resize.observe(node);
		for (const child of node.querySelectorAll("button")) resize.observe(child);
		sync();
	}
	const mutation = new MutationObserver(observeChildren);
	mutation.observe(node, {
		childList: true, subtree: true, characterData: true, attributes: true,
		attributeFilter: ["aria-selected", "aria-checked", "dir", "disabled"]
	});
	observeChildren();
	return { destroy() { resize.disconnect(); mutation.disconnect(); } };
}
