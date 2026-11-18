/**
 * Acción `use:portal` — reubica el nodo en `document.body` (u otro
 * destino) en vez de dejarlo donde el árbol de componentes lo montó.
 *
 * Por qué hace falta: Fase 3 encontró que `position: fixed` de
 * `BottomNavigation` quedaba CONTENIDO por cualquier ancestro con
 * `transform`/`filter`/`perspective`/`contain` (frecuente en layouts de
 * aplicación reales: un panel con transición, un contenedor con
 * `contain: layout`...) y hubo que arreglarlo por fuera, en la propia
 * demo de la guía de estilos. `Dialog`/`Modal`/`ToastStack` de Fase 5 se
 * apoyan en `position: fixed` para cubrir el viewport entero pase lo que
 * pase alrededor — así que esta vez se resuelve en origen, una vez, en
 * vez de pedirle a cada consumidor que audite sus ancestros.
 *
 * Patrón estándar (el mismo que usan Melt UI/Bits UI): mover el nodo de
 * verdad al DOM del body, no solo cambiar su posicionamiento CSS. `Menu`/
 * `DropdownMenu` (Fase 3) NO necesitaron esto porque su popover es
 * pequeño y se posiciona junto a su disparador con `position: absolute` —
 * aquí el contenido cubre el viewport completo, así que si quedara
 * atrapado dentro de un contenedor con overflow/transform ya no habría
 * un `transform: translateZ(0)` razonable que pedirle al consumidor.
 */
export function portal(node: HTMLElement, target: HTMLElement | string = "body") {
	function resolveTarget(t: HTMLElement | string): HTMLElement {
		if (typeof t !== "string") return t;
		return document.querySelector<HTMLElement>(t) ?? document.body;
	}

	function mount(t: HTMLElement | string) {
		resolveTarget(t).appendChild(node);
	}

	mount(target);

	return {
		update(newTarget: HTMLElement | string) {
			mount(newTarget);
		},
		destroy() {
			node.remove();
		}
	};
}
