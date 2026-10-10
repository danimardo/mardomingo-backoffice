// Límite de informes del navegador en memoria (W52): por visitante y global, en ventanas de un minuto.
// Es estado de módulo deliberado: un límite compartido por proceso, sin base de datos ni persistencia. Las
// claves de visitante no se registran en ningún log.
const WINDOW_MS = 60_000;
const PER_VISITOR_LIMIT = 20;
const GLOBAL_LIMIT = 300;
const MAX_TRACKED_VISITORS = 10_000;

interface Window {
	start: number;
	count: number;
}

const perVisitor = new Map<string, Window>();
let global: Window = { start: 0, count: 0 };

/** Cuenta un informe y devuelve `true` si cabe en los límites de su ventana. */
export function admitClientErrorReport(visitor: string, nowMs: number): boolean {
	if (!admit(global, GLOBAL_LIMIT, nowMs)) return false;

	if (perVisitor.size >= MAX_TRACKED_VISITORS) perVisitor.clear();
	const window = perVisitor.get(visitor) ?? { start: nowMs, count: 0 };
	perVisitor.set(visitor, window);
	return admit(window, PER_VISITOR_LIMIT, nowMs);
}

function admit(window: Window, limit: number, nowMs: number): boolean {
	if (nowMs - window.start >= WINDOW_MS) {
		window.start = nowMs;
		window.count = 0;
	}
	if (window.count >= limit) return false;
	window.count += 1;
	return true;
}

/** Solo para pruebas: vacía el estado de los límites. */
export function resetClientErrorLimits(): void {
	perVisitor.clear();
	global = { start: 0, count: 0 };
}
