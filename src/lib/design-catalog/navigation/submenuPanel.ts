/**
 * Utilidad compartida entre `SubmenuItem` (ampliación 2) y cualquier
 * contenedor de menú con detección de "click fuera" (`DropdownMenu`,
 * `ContextMenu`, ambos de Fase 3/ampliación 1) — NO específica de un solo
 * consumidor, por eso vive en su propio módulo en vez de duplicarse.
 *
 * Motivo de que exista: `SubmenuItem` monta su panel anidado con
 * `use:portal` (en `document.body`) para que `Menu.svelte`
 * (`querySelectorAll('[role="menuitem"]')`) no confunda los items del
 * submenú con los del nivel superior — ver la nota de cabecera de
 * `SubmenuItem.svelte`. Ese mismo portal, sin embargo, saca al panel del
 * subárbol DOM del contenedor (`container`/`menuEl`) que `DropdownMenu` y
 * `ContextMenu` usan para decidir si un click cayó "fuera". Sin este
 * ajuste, CUALQUIER click dentro de un submenú anidado (p.ej. elegir un
 * item) se vería como un click fuera del menú padre y lo cerraría de
 * golpe — antes incluso de que el propio `click` del item llegara a
 * disparar su `onclick` (el cierre ocurre en `mousedown`, que precede al
 * `click`).
 *
 * `e.stopPropagation()` en el propio panel NO basta: Svelte 5 delega
 * varios eventos comunes (entre ellos `mousedown`) en un listener
 * compartido, así que el `mousedown` seguía disparando también los
 * listeners `document.addEventListener('mousedown', ...)` de
 * `DropdownMenu`/`ContextMenu` — son registros distintos sobre el mismo
 * nodo `document`, y `stopPropagation` no impide que otros listeners YA
 * registrados en ese mismo nodo se ejecuten (para eso haría falta
 * `stopImmediatePropagation`, que tampoco ayuda aquí porque el orden de
 * registro no está garantizado). La solución robusta es que el propio
 * contenedor reconozca el panel anidado como "parte de sí mismo".
 */

/** Clase que lleva el panel portal-mounted de `SubmenuItem` (ver su `<style>`). */
const SUBMENU_PANEL_CLASS = "gg-submenu-item__panel";

/**
 * True si `target` cae dentro de un panel de `SubmenuItem` actualmente
 * abierto, estén donde estén en el DOM (con o sin portal). Pensado para
 * añadirse, con `||`, a una comprobación `container.contains(target)` ya
 * existente — nunca para sustituirla.
 */
export function isInsideSubmenuPanel(target: Node | null): boolean {
	if (!target) return false;
	const el = target instanceof Element ? target : target.parentElement;
	return !!el?.closest(`.${SUBMENU_PANEL_CLASS}`);
}
