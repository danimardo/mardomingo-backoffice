// Orden de las comprobaciones de `/ai/chat` (api-v1 1.8 pasos 5–14; FR-063; T160).
import { describe, expect, it } from 'vitest';
import { CHAT_STEP_ORDER, PROTECTIONS_STEPS, runPipeline, type PipelineStep } from './pipeline';

describe('orden de las comprobaciones de chat (api-v1 1.8)', () => {
	it('sigue el orden de la tabla: sesión, versión, mantenimiento, freno, legal, idempotencia, forma, frecuencia, coste y saldo', () => {
		expect([...CHAT_STEP_ORDER]).toEqual([
			'session',
			'app_version',
			'maintenance',
			'global_freeze',
			'legal',
			'idempotency',
			'validation',
			'rate_limit',
			'max_cost',
			'balance'
		]);
	});

	it('las comprobaciones de protections son puntos de composición, no lógica de ai', () => {
		expect([...PROTECTIONS_STEPS].sort()).toEqual([
			'app_version',
			'global_freeze',
			'maintenance',
			'rate_limit'
		]);
	});
});

describe('runPipeline', () => {
	const ok = (): null => null;

	it('sin fallos devuelve null y evalúa todos los pasos en orden', () => {
		const calls: string[] = [];
		const steps: PipelineStep<null>[] = CHAT_STEP_ORDER.map((name) => ({
			name,
			check: () => {
				calls.push(name);
				return ok();
			}
		}));

		expect(runPipeline(steps, null)).toBeNull();
		expect(calls).toEqual([...CHAT_STEP_ORDER]);
	});

	it('el primer fallo gana y los pasos posteriores no se ejecutan', () => {
		const calls: string[] = [];
		const steps: PipelineStep<null>[] = [
			{
				name: 'legal',
				check: () => (calls.push('legal'), { step: 'legal', code: 'TERMS_ACCEPTANCE_REQUIRED' })
			},
			{
				name: 'idempotency',
				check: () => (calls.push('idempotency'), { step: 'idempotency', code: 'DUPLICATE_REQUEST' })
			}
		];

		expect(runPipeline(steps, null)).toEqual({ step: 'legal', code: 'TERMS_ACCEPTANCE_REQUIRED' });
		expect(calls).toEqual(['legal']);
	});
});
