// Puerto de la fuente del tipo de cambio del BCE (BE-FR-87; R13; T149). El servicio de `pricing` solo ve este contrato.
// `empty` es una respuesta válida sin publicación (fin de semana o festivo), no un fallo.

export type EcbFetch =
	| { readonly status: 'observation'; readonly timePeriod: string; readonly rate: string }
	| { readonly status: 'empty' }
	| { readonly status: 'error'; readonly reason: 'http' | 'unavailable' | 'invalid' };

export interface FxSource {
	/** Última observación EUR→USD del BCE. Nunca lanza: los fallos vuelven como `error`. */
	fetchLatest(): Promise<EcbFetch>;
}
