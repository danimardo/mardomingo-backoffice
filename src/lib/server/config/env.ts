// Único módulo que lee el entorno del proceso (constitución, «Configuración y variables de entorno»).
// Ningún otro módulo importa `$env/*` ni lee `process.env`: el resto recibe la configuración
// tipada por parámetro. La validación se llama desde el hook `init`, protegido con `building`.
import { env as privateEnv } from '$env/dynamic/private';
import { env as publicEnv } from '$env/dynamic/public';
import { parseEnv, type Env } from './env-schema';

/** Lee y valida el entorno. Lanza `EnvConfigError` si falta algo o no es válido. */
export function readEnv(): Env {
	return parseEnv({ ...publicEnv, ...privateEnv });
}
