// Versión de la aplicación, leída de `package.json` (campo `version` de los logs y del navegador).
import pkg from '../../package.json';

export const APP_VERSION: string = pkg.version;
