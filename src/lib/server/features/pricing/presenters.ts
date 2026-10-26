// Presentación de los precios orientativos (T346; BE-FR-73, FR-037; contracts/web-routes.md W03). Funciones puras: reciben
// los costes típicos ya convertidos a créditos y devuelven el modelo de vista con claves exactas. Nunca incluyen el modelo
// del proveedor ni el coste real.
import { civilDateOf } from '$lib/shared/dates';
import { toEpochMs, type CivilDate } from '$lib/shared/time';

export interface PriceOperation {
	readonly appName: string;
	readonly name: string;
	/** Coste típico en micro-créditos, o `null` si aún no hay valor. */
	readonly typicalMicro: number | null;
	readonly source: 'auto' | 'manual' | null;
}

export interface PricePage {
	readonly groups: readonly {
		readonly appName: string;
		readonly operations: readonly {
			readonly name: string;
			readonly typicalMicro: number | null;
			readonly source: 'auto' | 'manual' | null;
		}[];
	}[];
	readonly examples: {
		readonly dictationMinuteMicro: number | null;
		/** Décimas de hora de dictado que caben en un paquete de 5 €. */
		readonly hoursPerPack5EurTenths: number | null;
	};
	/** Día (Madrid) del último cálculo del coste típico. */
	readonly computedOn: CivilDate | null;
}

/** Décimas de hora que caben en un paquete a un precio por minuto, redondeando hacia abajo. */
export function hoursPerPackTenths(input: {
	readonly packCreditsMicro: number;
	readonly minuteMicro: number | null;
}): number | null {
	if (input.minuteMicro === null || input.minuteMicro <= 0) return null;
	const tenths = (BigInt(input.packCreditsMicro) * 10n) / (BigInt(input.minuteMicro) * 60n);
	return Number(tenths);
}

/** Agrupa las operaciones por app (conservando el orden recibido) y calcula los ejemplos legibles. */
export function pricePageOf(input: {
	readonly operations: readonly PriceOperation[];
	readonly dictationMinuteMicro: number | null;
	readonly packCreditsMicro: number;
	readonly computedAt: number | null;
}): PricePage {
	const byApp = new Map<
		string,
		{ name: string; typicalMicro: number | null; source: PriceOperation['source'] }[]
	>();
	for (const operation of input.operations) {
		const list = byApp.get(operation.appName) ?? [];
		list.push({
			name: operation.name,
			typicalMicro: operation.typicalMicro,
			source: operation.source
		});
		byApp.set(operation.appName, list);
	}
	return {
		groups: [...byApp].map(([appName, operations]) => ({ appName, operations })),
		examples: {
			dictationMinuteMicro: input.dictationMinuteMicro,
			hoursPerPack5EurTenths: hoursPerPackTenths({
				packCreditsMicro: input.packCreditsMicro,
				minuteMicro: input.dictationMinuteMicro
			})
		},
		computedOn: input.computedAt === null ? null : civilDateOf(toEpochMs(input.computedAt))
	};
}
