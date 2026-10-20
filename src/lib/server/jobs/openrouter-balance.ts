// Tarea `openrouter-balance` (T326; BE-FR-33, L14): consulta el saldo de la cuenta de OpenRouter y levanta o limpia la alerta según
// el umbral `openrouter_balance_alert_usd` (micro-USD). Si el proveedor no responde no cambia el estado de la alerta: no hay
// información nueva que justifique avisar ni rearmar.
import type { AiGateway } from '$lib/server/adapters/openrouter/gateway';
import {
	alertKeys,
	clearAlert,
	raiseAlert,
	type AlertDeps
} from '$lib/server/features/notifications';

export type BalanceRun = 'alert' | 'clear' | 'unavailable';

export async function runOpenRouterBalance(input: {
	readonly gateway: Pick<AiGateway, 'creditsBalanceMicroUsd'>;
	readonly thresholdMicroUsd: number;
	readonly alerts: AlertDeps;
}): Promise<BalanceRun> {
	const balance = await input.gateway.creditsBalanceMicroUsd(AbortSignal.timeout(15_000));
	if (balance === null) return 'unavailable';
	if (balance < input.thresholdMicroUsd) {
		await raiseAlert(input.alerts, {
			key: alertKeys.openrouterBalance(),
			detail: `Saldo de OpenRouter: ${String(balance)} µUSD, por debajo del umbral de ${String(input.thresholdMicroUsd)} µUSD.`
		});
		return 'alert';
	}
	clearAlert(input.alerts, alertKeys.openrouterBalance());
	return 'clear';
}
