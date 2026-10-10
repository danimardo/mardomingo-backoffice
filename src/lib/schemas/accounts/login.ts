// Esquema del formulario de inicio de sesión W11 (BE-FR-03). La contraseña solo se comprueba como no vacía: la
// política de 8 a 128 caracteres se aplica al crearla, no al entrar (así no se revela nada de la cuenta).
import * as z from 'zod';

export const LoginSchema = z.strictObject({
	email: z.email(),
	password: z.string().min(1).max(128),
	redirectTo: z.string().max(2048).optional()
});
