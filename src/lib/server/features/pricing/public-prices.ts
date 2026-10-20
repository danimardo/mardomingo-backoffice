// Datos de la página pública de precios orientativos (T350; BE-FR-73; W03). Une el catálogo de operaciones activas (`apps`) con
// el coste típico guardado (`pricing`) y lo convierte a créditos con la tarificación vigente. Nunca devuelve el modelo ni el
// coste real: solo créditos y el origen del valor.
import { activeOperationsForPrices, getSetting } from '$lib/server/features/apps';
import { MICRO_PER_CREDIT } from '$lib/shared/money';
import { pricePageOf, type PricePage } from './presenters';
import { effectivePriceReferences } from './repository';
import { chargeFor, type PricingDeps } from './service';

const PACK_EUR = 5;

function numberSetting(deps: PricingDeps, key: Parameters<typeof getSetting>[1]): number | null {
	const value = getSetting(deps.apps, key);
	return typeof value === 'number' ? value : null;
}

/** Página de precios orientativos con los costes típicos de las operaciones activas, en créditos. */
export function publicPricePage(deps: PricingDeps): PricePage {
	const operations = activeOperationsForPrices(deps.db);
	const references = effectivePriceReferences(deps.db);

	const priced = operations.map((operation) => {
		const reference = references.get(operation.operationId);
		return {
			appName: operation.appName,
			name: operation.name,
			typicalMicro:
				reference === undefined
					? null
					: chargeFor(deps, {
							appId: operation.appId,
							operationKey: operation.key,
							costMicroUsd: reference.typicalMicroUsd,
							provider: operation.kind === 'transcription' ? 'mistral' : 'openrouter'
						}).chargeMicro,
			source: reference?.source ?? null
		};
	});

	// «1 minuto de dictado»: el precio por minuto de la transcripción, con la misma comisión, tipo y margen que el cobro real.
	const transcription = operations.find((operation) => operation.kind === 'transcription');
	const voxtralPerMinute = numberSetting(deps, 'voxtral_price_per_minute_usd');
	const dictationMinuteMicro =
		transcription === undefined || voxtralPerMinute === null
			? null
			: chargeFor(deps, {
					appId: transcription.appId,
					operationKey: transcription.key,
					costMicroUsd: voxtralPerMinute,
					provider: 'mistral'
				}).chargeMicro;

	const creditsPerEur = numberSetting(deps, 'credits_per_eur_purchase') ?? 0;
	const computed = [...references.values()].flatMap((reference) =>
		reference.computedAt === null ? [] : [reference.computedAt]
	);

	return pricePageOf({
		operations: priced,
		dictationMinuteMicro,
		packCreditsMicro: PACK_EUR * creditsPerEur * MICRO_PER_CREDIT,
		computedAt: computed.length === 0 ? null : Math.max(...computed)
	});
}
