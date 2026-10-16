// Esquema del formulario de borrado de cuenta W29 (BE-FR-07; T285). Estricto: un campo desconocido se rechaza. La casilla de
// «entiendo que pierdo el saldo» es obligatoria y nunca viene premarcada: si no llega, vale `false`.
import * as z from 'zod';
import { PASSWORD_MAX } from '../accounts/register';

export const DeleteAccountSchema = z.strictObject({
	password: z.string().min(1).max(PASSWORD_MAX),
	confirmLoss: z.literal(true)
});

export const DELETE_ACCOUNT_CHECKBOXES: readonly string[] = Object.freeze(['confirmLoss']);
