// Cambio de contraseña desde el panel (W27; T266, BE-FR-05). Exige la contraseña actual y la repetición de la nueva; las reglas de
// longitud son las del registro. La comparación de las dos contraseñas nuevas se hace aquí, no en el cliente.
import * as z from 'zod';
import { PASSWORD_MAX, PASSWORD_MIN } from './register';

export const ChangePasswordSchema = z
	.strictObject({
		currentPassword: z.string().min(1).max(PASSWORD_MAX),
		newPassword: z.string().min(PASSWORD_MIN).max(PASSWORD_MAX),
		confirmation: z.string().min(1).max(PASSWORD_MAX)
	})
	.refine((value) => value.newPassword === value.confirmation, {
		path: ['confirmation'],
		message: 'validation_invalid'
	});
