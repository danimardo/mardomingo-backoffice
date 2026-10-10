// Esquemas de la recuperación de contraseña (W12 y W13; BE-FR-05).
import * as z from 'zod';
import { PASSWORD_MAX, PASSWORD_MIN } from './register';

export const RequestResetSchema = z.strictObject({ email: z.email() });

export const ResetPasswordSchema = z.strictObject({
	token: z.string().min(1).max(512),
	password: z.string().min(PASSWORD_MIN).max(PASSWORD_MAX)
});
