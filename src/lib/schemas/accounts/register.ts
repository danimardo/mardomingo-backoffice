// Esquema del formulario de registro W08 (BE-FR-01; contracts/web-routes.md W08). Estricto: un campo desconocido se
// rechaza. Las cuatro casillas son obligatorias y nunca vienen premarcadas: si la casilla no llega, vale `false`.
import * as z from 'zod';

export const PASSWORD_MIN = 8;
export const PASSWORD_MAX = 128;

export const RegisterSchema = z.strictObject({
	email: z.email(),
	password: z.string().min(PASSWORD_MIN).max(PASSWORD_MAX),
	acceptTerms: z.literal(true),
	acceptPrivacy: z.literal(true),
	acceptAup: z.literal(true),
	ageDeclaration: z.literal(true),
	'cf-turnstile-response': z.string().max(2048).optional(),
	app: z.string().max(64).optional(),
	versionTerms: z.string().min(1).max(64),
	versionPrivacy: z.string().min(1).max(64),
	versionAup: z.string().min(1).max(64)
});

export const REGISTER_CHECKBOXES: readonly string[] = Object.freeze([
	'acceptTerms',
	'acceptPrivacy',
	'acceptAup',
	'ageDeclaration'
]);
