// Plantilla de prompt para las pruebas (T173): una operación `plantilla` del `seededAppId` creada por el servicio de `apps`
// (BE-FR-78, 79), con una versión publicada. No se inserta nada a mano: así la prueba usa las mismas reglas que el
// administrador.
import { createOperation, createTemplateVersion, type AppsDeps } from '$lib/server/features/apps';
import { SEEDED_APP_ID } from '../setup/integration.global-setup';

export interface SeededPromptTemplate {
	readonly operationId: string;
	readonly version: number;
}

let counter = 0;

/** Crea una operación `plantilla` inactiva y publica su primera versión con un mensaje de sistema y una variable de texto. */
export function seededPromptTemplate(deps: AppsDeps, actorId: string): SeededPromptTemplate {
	counter += 1;
	const operationId = createOperation(deps, actorId, SEEDED_APP_ID, {
		key: `plantilla_prueba_${String(counter)}`,
		name: `Plantilla de prueba ${String(counter)}`,
		kind: 'chat',
		mode: 'plantilla',
		model: null,
		maxOutputTokens: 512,
		maxCostMicro: 12_000_000,
		timeoutMs: 30_000,
		capabilities: { image_input: false, structured_output: false, tools: false },
		active: false
	});
	const version = createTemplateVersion(deps, {
		actorId,
		operationId,
		body: {
			messages: [
				{ role: 'system', content: 'Eres un corrector.' },
				{ role: 'user', content: [{ type: 'text', text: '{{texto}}' }] }
			],
			variables: [{ name: 'texto', type: 'text', required: true, max_chars: 2000 }]
		}
	});
	return { operationId, version };
}
