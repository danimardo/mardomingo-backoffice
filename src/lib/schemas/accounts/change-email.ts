// Cambio de email desde el panel (W27; T266, BE-FR-66). Exige la contraseña actual y la nueva dirección; la comprobación de que
// la dirección es válida y libre la hace `accounts` al pedirlo, sin revelarla a quien pregunta.
import * as z from 'zod';
import { PASSWORD_MAX } from './register';

export const ChangeEmailSchema = z.strictObject({
	newEmail: z.email().max(254),
	currentPassword: z.string().min(1).max(PASSWORD_MAX)
});
