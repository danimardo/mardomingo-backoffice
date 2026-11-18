/**
 * `createToastStore()` — estado reactivo compartido para `ToastStack`
 * (§23). Un Toast, a diferencia de `Alert`, no vive en el árbol de la
 * página donde el consumidor lo escribe — lo dispara código imperativo
 * arbitrario ("guardado con éxito" tras una petición, "conexión
 * perdida" desde un listener...), así que hace falta una fábrica de
 * estado que cualquier parte de la app pueda importar y llamar, no una
 * prop de componente. Primer fichero `.svelte.ts` del paquete: los
 * runes (`$state`) funcionan fuera de un `.svelte` siempre que el
 * fichero tenga esta extensión — es el patrón recomendado por Svelte 5
 * para estado compartido reutilizable (equivalente a un store de Svelte
 * 4, pero con la misma sintaxis de runes que el resto del paquete).
 *
 * Deliberadamente NO es un singleton exportado directo (`export const
 * toastStore = createToastStore()`) — cada app que consuma este paquete
 * llama a `createToastStore()` una vez (normalmente en su `AppShell` de
 * Fase 6) y pasa el resultado donde haga falta, igual que
 * `AdaptiveDataView` recibe `selected`/`sort` en vez de tener su propio
 * estado global oculto.
 */
import type { FeedbackTone } from "./types.js";

export interface ToastOptions {
	tone?: FeedbackTone;
	title?: string | undefined;
	message: string;
	/** ms antes de autocerrarse. `0` desactiva el autocierre (el usuario debe descartarlo a mano). */
	duration?: number;
}

export interface ToastItem {
	id: string;
	tone: FeedbackTone;
	title?: string | undefined;
	message: string;
	duration: number;
}

let uid = 0;

export function createToastStore() {
	let toasts = $state<ToastItem[]>([]);

	function show(options: ToastOptions): string {
		const id = `gg-toast-${++uid}`;
		const duration = options.duration ?? 5000;
		toasts.push({
			id,
			tone: options.tone ?? "neutral",
			title: options.title,
			message: options.message,
			duration
		});
		if (duration > 0) {
			setTimeout(() => dismiss(id), duration);
		}
		return id;
	}

	function dismiss(id: string) {
		toasts = toasts.filter((t) => t.id !== id);
	}

	function clear() {
		toasts = [];
	}

	return {
		get toasts() {
			return toasts;
		},
		show,
		dismiss,
		clear
	};
}

export type ToastStore = ReturnType<typeof createToastStore>;
