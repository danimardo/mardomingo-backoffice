// Preparación de cada ejecución E2E: vacía el registro del estado de UX para que solo recoja esta corrida y arranca el
// simulador de Turnstile en el puerto que `playwright.config.ts` le da al servidor (`MOCK_TURNSTILE_URL`). El simulador
// se cierra al terminar la ejecución.
import { rmSync } from 'node:fs';
import { startTurnstileMock } from '../tests/mock-servers/turnstile';
import { TURNSTILE_MOCK_PORT } from './constants';
import { UX_STATUS_FILE } from './fixtures/ux-emulation';

export default async function globalSetup(): Promise<() => Promise<void>> {
	rmSync(UX_STATUS_FILE, { force: true });
	const turnstile = await startTurnstileMock(TURNSTILE_MOCK_PORT);
	return async () => {
		await turnstile.close();
	};
}
