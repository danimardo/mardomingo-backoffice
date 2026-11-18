import { getContext, hasContext, setContext } from "svelte";
import type { IconConfig, IconFamily, MissingIconPolicy } from "./types.js";

const ICON_CONTEXT_KEY = Symbol.for("becall-icon-config");

interface InternalIconState {
	family: IconFamily;
	exceptions: readonly string[];
	onMissing: MissingIconPolicy;
}

function readDomDefaultFamily(): IconFamily {
	if (typeof document !== "undefined") {
		const attr = document.documentElement?.getAttribute("data-icon-family");
		if (attr === "clay" || attr === "lucide") return attr;
	}
	if (typeof location !== "undefined") {
		try {
			const q = new URLSearchParams(location.search).get("icons");
			if (q === "clay" || q === "lucide") return q;
		} catch {
			// Ignorar entornos sin URL válida
		}
	}
	return "lucide";
}

let globalState = $state<InternalIconState>({
	family: readDomDefaultFamily(),
	exceptions: [],
	onMissing: "warn"
});

const warnedMissing = new Set<string>();

/**
 * Configura la familia de iconos y la lista de excepciones en el contexto de
 * componente actual (o globalmente si se llama desde la raíz).
 */
export function setIconConfig(config: IconConfig): InternalIconState {
	const stateObj = $state<InternalIconState>({
		family: config.family ?? readDomDefaultFamily(),
		exceptions: config.exceptions ?? [],
		onMissing: config.onMissing ?? "warn"
	});
	// Sincronizamos también el estado global por defecto cuando se invoca en la raíz
	globalState.family = stateObj.family;
	globalState.exceptions = stateObj.exceptions;
	globalState.onMissing = stateObj.onMissing;
	try {
		setContext(ICON_CONTEXT_KEY, stateObj);
	} catch {
		// Si se llama fuera de la inicialización de un componente, actualiza globalState
	}
	return stateObj;
}

/** Obtiene la configuración reactiva de iconos activa en este punto del árbol. */
export function getIconConfig(): InternalIconState {
	try {
		if (hasContext(ICON_CONTEXT_KEY)) {
			return getContext<InternalIconState>(ICON_CONTEXT_KEY);
		}
	} catch {
		// Fuera de ciclo de montaje de componente
	}
	return globalState;
}

/** Registra o lanza una ausencia no declarada en la familia `"clay"`. */
export function reportMissingClayIcon(name: string, policy: MissingIconPolicy): void {
	const msg = `[@becall/design-system] El icono "${name}" no tiene variante en la familia "clay" ni está declarado en "exceptions". Se muestra el icono de contorno ("lucide") como respaldo.`;
	if (policy === "throw") {
		throw new Error(msg);
	}
	if (policy === "warn" && !warnedMissing.has(name)) {
		warnedMissing.add(name);
		console.warn(msg);
	}
}

/** Limpia el registro de avisos emitidos (útil para tests). */
export function resetMissingIconWarnings(): void {
	warnedMissing.clear();
}
