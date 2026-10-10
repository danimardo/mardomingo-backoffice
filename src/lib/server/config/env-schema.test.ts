import { describe, expect, it } from 'vitest';
import { EnvConfigError, parseEnv } from './env-schema';

// Valores de prueba: nunca reales. Sirven para comprobar que los mensajes de error
// enumeran nombres y jamás valores (Historias.md 15.19).
const SECRET_VALUE = 'SECRETO-DE-PRUEBA-no-debe-aparecer-123456';

const TEST_BASE: Record<string, string> = {
	APP_ENV: 'test',
	PUBLIC_API_URL: 'http://127.0.0.1:7312',
	PUBLIC_WEB_URL: 'http://localhost:7312',
	BETTER_AUTH_URL: 'http://localhost:7312',
	DATABASE_PATH: ':memory:',
	BETTER_AUTH_SECRET: 'a'.repeat(32),
	EMAIL_HASH_KEY: 'b'.repeat(32)
};

const PROD_BASE: Record<string, string> = {
	APP_ENV: 'production',
	PUBLIC_API_URL: 'https://api.mardomingo.com',
	PUBLIC_WEB_URL: 'https://cuenta.mardomingo.com',
	BETTER_AUTH_URL: 'https://cuenta.mardomingo.com',
	DATABASE_PATH: '/data/app.db',
	BETTER_AUTH_SECRET: 'c'.repeat(32),
	EMAIL_HASH_KEY: 'd'.repeat(32),
	PUBLIC_TURNSTILE_SITE_KEY: '0x4AAAAAAAB-produccion',
	TURNSTILE_SECRET: '0x4AAAAAAAB-secreto-produccion',
	OPENROUTER_API_KEY: 'sk-or-produccion',
	MISTRAL_API_KEY: 'mistral-produccion',
	RESEND_API_KEY: 're_produccion'
};

/** Copia del entorno sin una clave. */
function omit(source: Readonly<Record<string, string>>, key: string): Record<string, string> {
	return Object.fromEntries(Object.entries(source).filter(([name]) => name !== key));
}

/** Ejecuta la validación y devuelve el error de configuración, o falla si no lo lanza. */
function envErrorOf(run: () => unknown): EnvConfigError {
	try {
		run();
	} catch (error) {
		if (error instanceof EnvConfigError) return error;
		throw error;
	}
	throw new Error('Se esperaba un EnvConfigError y no se lanzó ninguno');
}

describe('parseEnv', () => {
	it('acepta la configuración mínima de test y aplica los valores por defecto', () => {
		const env = parseEnv(TEST_BASE);

		expect(env.APP_ENV).toBe('test');
		expect(env.PORT).toBe(3000);
		expect(env.HOST).toBe('0.0.0.0');
		expect(env.PAYMENTS_PROVIDER).toBe('simulated');
		expect(env.INVOICING_PROVIDER).toBe('none');
		expect(env.LOG_LEVEL).toBe('debug');
		expect(env.CLIENT_LOG_LEVEL).toBe('debug');
		expect(env.CAPTCHA_FAKE).toBe(false);
	});

	it('no exige las variables de producción cuando APP_ENV es test', () => {
		expect(() => parseEnv(TEST_BASE)).not.toThrow();
	});

	it('enumera el nombre de la variable que falta, nunca un valor', () => {
		const error = envErrorOf(() => parseEnv(omit(TEST_BASE, 'BETTER_AUTH_SECRET')));

		expect(error.names).toContain('BETTER_AUTH_SECRET');
		expect(error.message).toContain('BETTER_AUTH_SECRET');
	});

	it('no incluye en el error el valor recibido, aunque sea inválido', () => {
		const error = envErrorOf(() => parseEnv({ ...TEST_BASE, PORT: SECRET_VALUE }));

		expect(error.names).toContain('PORT');
		expect(error.message).not.toContain(SECRET_VALUE);
		expect(JSON.stringify(error.names)).not.toContain(SECRET_VALUE);
	});

	it('rechaza el proveedor de pagos Stripe en la v4', () => {
		expect(() => parseEnv({ ...TEST_BASE, PAYMENTS_PROVIDER: 'stripe' })).toThrow(EnvConfigError);
	});

	it('rechaza un proveedor de facturación distinto de none en la v4', () => {
		expect(() => parseEnv({ ...TEST_BASE, INVOICING_PROVIDER: 'verifactu' })).toThrow(
			EnvConfigError
		);
	});

	it('rechaza las opciones de prueba fuera de APP_ENV=test', () => {
		const error = envErrorOf(() =>
			parseEnv({ ...PROD_BASE, CAPTCHA_FAKE: 'true', EMAIL_OUTBOX_DIR: '.outbox' })
		);

		expect(error.names).toEqual(expect.arrayContaining(['CAPTCHA_FAKE', 'EMAIL_OUTBOX_DIR']));
	});

	it('acepta las opciones de prueba cuando APP_ENV es test', () => {
		const env = parseEnv({
			...TEST_BASE,
			CAPTCHA_FAKE: 'true',
			EMAIL_OUTBOX_DIR: '.outbox',
			MOCK_OPENROUTER_URL: 'http://127.0.0.1:7380'
		});

		expect(env.CAPTCHA_FAKE).toBe(true);
		expect(env.EMAIL_OUTBOX_DIR).toBe('.outbox');
		expect(env.MOCK_OPENROUTER_URL).toBe('http://127.0.0.1:7380');
	});

	it('acepta una configuración de producción completa', () => {
		const env = parseEnv(PROD_BASE);

		expect(env.APP_ENV).toBe('production');
		expect(env.LOG_LEVEL).toBe('info');
		expect(env.CLIENT_LOG_LEVEL).toBe('warn');
	});

	it('rechaza localhost en las URL públicas de producción', () => {
		const error = envErrorOf(() =>
			parseEnv({ ...PROD_BASE, PUBLIC_WEB_URL: 'http://localhost:7311' })
		);

		expect(error.names).toContain('PUBLIC_WEB_URL');
	});

	it('rechaza las claves de prueba de Turnstile en producción', () => {
		const error = envErrorOf(() =>
			parseEnv({
				...PROD_BASE,
				PUBLIC_TURNSTILE_SITE_KEY: '1x00000000000000000000AA',
				TURNSTILE_SECRET: '1x0000000000000000000000000000000AA'
			})
		);

		expect(error.names).toEqual(
			expect.arrayContaining(['PUBLIC_TURNSTILE_SITE_KEY', 'TURNSTILE_SECRET'])
		);
	});

	it('exige los proveedores de IA, email y captcha en producción', () => {
		const error = envErrorOf(() => parseEnv(omit(PROD_BASE, 'RESEND_API_KEY')));

		expect(error.names).toContain('RESEND_API_KEY');
	});

	it('exige EMAIL_HASH_KEY en todos los entornos', () => {
		expect(() => parseEnv(omit(TEST_BASE, 'EMAIL_HASH_KEY'))).toThrow(EnvConfigError);
	});

	it('acepta el gestor de OpenRouter como opcional', () => {
		expect(() => parseEnv(TEST_BASE)).not.toThrow();
		expect(() =>
			parseEnv({ ...TEST_BASE, OPENROUTER_MANAGEMENT_KEY: 'sk-or-gestion' })
		).not.toThrow();
	});

	it('rechaza un puerto fuera de rango', () => {
		expect(() => parseEnv({ ...TEST_BASE, PORT: '70000' })).toThrow(EnvConfigError);
	});

	it('acepta un nivel de log explícito y lo respeta', () => {
		const env = parseEnv({ ...PROD_BASE, LOG_LEVEL: 'debug' });

		expect(env.LOG_LEVEL).toBe('debug');
	});

	it('en staging aplica las reglas de despliegue y no rechaza las claves de prueba de Turnstile', () => {
		expect(() =>
			parseEnv({
				...PROD_BASE,
				APP_ENV: 'staging',
				PUBLIC_TURNSTILE_SITE_KEY: '1x00000000000000000000AA',
				TURNSTILE_SECRET: '1x0000000000000000000000000000000AA'
			})
		).not.toThrow();
	});

	it('en staging rechaza localhost y las claves obligatorias que falten', () => {
		const error = envErrorOf(() =>
			parseEnv({
				...PROD_BASE,
				APP_ENV: 'staging',
				PUBLIC_API_URL: 'http://localhost:7312',
				RESEND_API_KEY: ''
			})
		);

		expect(error.names).toEqual(expect.arrayContaining(['PUBLIC_API_URL', 'RESEND_API_KEY']));
	});

	it('ignora las variables sin valor, como las que no existen en process.env', () => {
		const env = parseEnv({ ...TEST_BASE, PORT: undefined, LOG_LEVEL: undefined });

		expect(env.PORT).toBe(3000);
		expect(env.LOG_LEVEL).toBe('debug');
	});
});
