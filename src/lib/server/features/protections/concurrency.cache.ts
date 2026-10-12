// Transcripciones en curso en memoria (BE-FR-43; T200). La ranura se libera en un `finally` de quien la adquiere; el
// contador es de una sola instancia y se pierde al reiniciar, lo que está aceptado en la v4.

export interface TranscriptionSlots {
	/** Transcripciones en curso de la cuenta (todas sus apps) y de esa app. */
	inFlight(userId: string, appId: string): { readonly account: number; readonly app: number };
	/** Ocupa una ranura y devuelve su liberación; liberar dos veces no cuenta dos veces. */
	acquire(userId: string, appId: string): () => void;
}

export function createTranscriptionSlots(): TranscriptionSlots {
	const account = new Map<string, number>();
	const perApp = new Map<string, number>();
	const bump = (store: Map<string, number>, key: string, delta: number): void => {
		const next = (store.get(key) ?? 0) + delta;
		if (next <= 0) store.delete(key);
		else store.set(key, next);
	};

	return {
		inFlight(userId, appId) {
			return {
				account: account.get(userId) ?? 0,
				app: perApp.get(`${userId}\u0000${appId}`) ?? 0
			};
		},
		acquire(userId, appId) {
			const appKey = `${userId}\u0000${appId}`;
			bump(account, userId, 1);
			bump(perApp, appKey, 1);
			let released = false;
			return () => {
				if (released) return;
				released = true;
				bump(account, userId, -1);
				bump(perApp, appKey, -1);
			};
		}
	};
}
