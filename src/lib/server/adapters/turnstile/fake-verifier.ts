// Verificador en memoria para las pruebas (T089). Responde con el resultado que se le fije; por defecto, válido.
import type { CaptchaCheck, CaptchaOutcome, CaptchaVerifier } from './captcha-verifier';

export interface FakeCaptchaVerifier extends CaptchaVerifier {
	readonly checks: readonly CaptchaCheck[];
	outcome(next: CaptchaOutcome): void;
}

export function createFakeCaptchaVerifier(initial: CaptchaOutcome = 'valid'): FakeCaptchaVerifier {
	const checks: CaptchaCheck[] = [];
	let current: CaptchaOutcome = initial;
	return {
		checks,
		outcome(next) {
			current = next;
		},
		verify(check: CaptchaCheck): Promise<CaptchaOutcome> {
			checks.push(check);
			return Promise.resolve(current);
		}
	};
}
