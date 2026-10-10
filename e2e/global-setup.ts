// Preparación de cada ejecución E2E: vacía el registro del estado de UX para que solo recoja esta corrida.
import { rmSync } from 'node:fs';
import { UX_STATUS_FILE } from './fixtures/ux-emulation';

export default function globalSetup(): void {
	rmSync(UX_STATUS_FILE, { force: true });
}
