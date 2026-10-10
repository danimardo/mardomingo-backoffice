// Configuración de drizzle-kit (R03). La ruta de la BD sale de la misma validación que la aplicación.
import { defineConfig } from 'drizzle-kit';
import { readDatabasePath } from './src/lib/server/config/env-schema';

export default defineConfig({
	dialect: 'sqlite',
	schema: './src/lib/server/features/*/schema.ts',
	out: './drizzle',
	dbCredentials: { url: readDatabasePath(process.env) }
});
