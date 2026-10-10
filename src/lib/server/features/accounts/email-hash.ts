// Hash del email normalizado para las tablas de antiabuso (D-11; BE-FR-11.5, BE-FR-67): `login_attempts` y
// `welcome_grants`. Usa HMAC-SHA256 con `EMAIL_HASH_KEY`, que llega por parámetro (el módulo no lee el entorno) y
// nunca se rota: cambiarla dejaría sin efecto los contadores y las concesiones ya guardadas. Vive fuera de `domain/`
// porque necesita `node:crypto`.
import { createHmac } from 'node:crypto';

/** HMAC-SHA256 en hexadecimal de una forma normalizada (`normalizeEmail`). */
export function hashNormalizedEmail(normalizedEmail: string, key: string): string {
	return createHmac('sha256', key).update(normalizedEmail, 'utf8').digest('hex');
}
