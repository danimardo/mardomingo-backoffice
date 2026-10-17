// Esquema del reenvío de la verificación W10 (BE-FR-02 CA3). La respuesta es siempre neutra.
import * as z from 'zod';

export const ResendSchema = z.strictObject({ email: z.email() });
