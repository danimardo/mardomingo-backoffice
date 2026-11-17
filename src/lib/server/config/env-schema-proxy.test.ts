// C-32 (T424): staging y producción exigen las variables del proxy y la imagen las fija, con el puerto 7311.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { EnvConfigError, parseEnv } from './env-schema';

const PROD_BASE: Record<string, string> = {
	APP_ENV: 'production',
	PUBLIC_API_URL: 'https://api.mardomingo.com',
	PUBLIC_WEB_URL: 'https://cuenta.mardomingo.com',
	BETTER_AUTH_URL: 'https://cuenta.mardomingo.com',
	DATABASE_PATH: '/data/app.db',
	BETTER_AUTH_SECRET: 'c'.repeat(32),
	EMAIL_HASH_KEY: 'd'.repeat(32),
	PUBLIC_TURNSTILE_SITE_KEY: 'sitekey-ficticia-produccion',
	TURNSTILE_SECRET: 'secreto-ficticio-para-validar-produccion',
	OPENROUTER_API_KEY: 'clave-ficticia-openrouter',
	MISTRAL_API_KEY: 'clave-ficticia-mistral',
	RESEND_API_KEY: 'clave-ficticia-resend'
};

function namesOf(run: () => unknown): readonly string[] {
	try {
		run();
	} catch (error) {
		if (error instanceof EnvConfigError) return error.names;
		throw error;
	}
	return [];
}

describe('[C-32] variables del proxy en un entorno desplegado', () => {
	it('en producción sin ADDRESS_HEADER, XFF_DEPTH ni PROTOCOL_HEADER el arranque falla nombrándolas', () => {
		const names = namesOf(() => parseEnv(PROD_BASE));

		expect(names).toEqual(
			expect.arrayContaining(['ADDRESS_HEADER', 'XFF_DEPTH', 'PROTOCOL_HEADER'])
		);
	});

	it('en staging sin ADDRESS_HEADER el arranque falla', () => {
		const names = namesOf(() =>
			parseEnv({
				...PROD_BASE,
				APP_ENV: 'staging',
				XFF_DEPTH: '1',
				PROTOCOL_HEADER: 'x-forwarded-proto'
			})
		);

		expect(names).toContain('ADDRESS_HEADER');
	});

	it('en producción con las tres variables el entorno es válido', () => {
		const env = parseEnv({
			...PROD_BASE,
			ADDRESS_HEADER: 'x-forwarded-for',
			XFF_DEPTH: '1',
			PROTOCOL_HEADER: 'x-forwarded-proto',
			PORT: '7311'
		});

		expect(env.ADDRESS_HEADER).toBe('x-forwarded-for');
	});

	it('en desarrollo y test siguen con sus valores por defecto', () => {
		const dev = {
			...PROD_BASE,
			PUBLIC_API_URL: 'http://localhost:5173',
			PUBLIC_WEB_URL: 'http://localhost:5173',
			BETTER_AUTH_URL: 'http://localhost:5173'
		};
		for (const appEnv of ['development', 'test']) {
			const env = parseEnv({ ...dev, APP_ENV: appEnv });

			expect(env.ADDRESS_HEADER).toBe('x-forwarded-for');
			expect(env.XFF_DEPTH).toBe(1);
			expect(env.PROTOCOL_HEADER).toBe('x-forwarded-proto');
		}
	});
});

describe('[C-32] imagen Docker', () => {
	const dockerfile = readFileSync(resolve(process.cwd(), 'Dockerfile'), 'utf8');

	it('fija ADDRESS_HEADER, XFF_DEPTH y PROTOCOL_HEADER para adapter-node', () => {
		expect(dockerfile).toMatch(/ADDRESS_HEADER=x-forwarded-for/);
		expect(dockerfile).toMatch(/XFF_DEPTH=1/);
		expect(dockerfile).toMatch(/PROTOCOL_HEADER=x-forwarded-proto/);
	});

	it('escucha en el 7311 y no usa el 3000 (la constitución lo prohíbe)', () => {
		expect(dockerfile).toMatch(/PORT=7311/);
		expect(dockerfile).toMatch(/EXPOSE 7311/);
		expect(dockerfile).not.toMatch(/PORT=3000/);
		expect(dockerfile).not.toMatch(/EXPOSE 3000/);
	});
});
