// Programador de la tarea diaria (L14). Revisa cada cierto tiempo si el día ya corrió; `runDailyJob` decide con su bloqueo en base de
// datos, así que varias revisiones o procesos no repiten la ejecución. El temporizador no retiene el proceso al cerrarlo.
const CHECK_EVERY_MS = 10 * 60 * 1000;

export function startDailyScheduler(
	run: () => Promise<unknown>,
	onError: (error: unknown) => void
): () => void {
	const tick = (): void => {
		run().catch(onError);
	};
	const timer = setInterval(tick, CHECK_EVERY_MS);
	timer.unref();
	tick();
	return () => {
		clearInterval(timer);
	};
}
