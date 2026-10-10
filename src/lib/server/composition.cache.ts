// Contenedor de la composición del proceso. Se asigna una sola vez en `init` y es de solo lectura después.
// Es la única excepción de estado de módulo permitida por el test de arquitectura (ARCHITECTURE.md §5).
import type { Composition } from './composition';

let current: Composition | undefined;

export function setComposition(value: Composition): void {
	if (current !== undefined) throw new Error('La composición ya está asignada.');
	current = value;
}

export function getComposition(): Composition {
	if (current === undefined) throw new Error('La composición no existe: falta la inicialización.');
	return current;
}
