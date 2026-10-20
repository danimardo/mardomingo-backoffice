// Presentación de las landings públicas (T346; BE-FR-59; contracts/web-routes.md W01 y W02). Claves exactas con
// `toStrictEqual`: la landing nunca expone el estado interno, los orígenes CORS ni la configuración de operaciones.
import { describe, expect, it } from 'vitest';
import { appPageOf, landingListOf, type LandingAppRow } from './presenters';

const INSTALLER =
	'https://github.com/danimardo/secretario2/releases/latest/download/SecretarioAI-Setup.exe';

const SECRETARIO: LandingAppRow = {
	slug: 'secretario',
	name: 'Secretario AI',
	description: 'Dicta y redacta con IA.',
	status: 'active',
	clientTypes: ['desktop'],
	links: { landing: { type: 'internal' }, download_url: INSTALLER },
	supportEmail: null
};

describe('landingListOf (W01)', () => {
	it('lista solo las apps activas, con su landing interna o externa', () => {
		const rows: LandingAppRow[] = [
			SECRETARIO,
			{
				...SECRETARIO,
				slug: 'externa',
				name: 'Externa',
				description: '',
				links: { landing: { type: 'external', url: 'https://externa.example/inicio' } }
			},
			{ ...SECRETARIO, slug: 'apagada', name: 'Apagada', status: 'disabled' }
		];

		expect(landingListOf(rows)).toStrictEqual([
			{
				slug: 'externa',
				name: 'Externa',
				description: '',
				landing: { kind: 'external', url: 'https://externa.example/inicio' }
			},
			{
				slug: 'secretario',
				name: 'Secretario AI',
				description: 'Dicta y redacta con IA.',
				landing: { kind: 'internal', url: null }
			}
		]);
	});

	it('sin ninguna app activa, una lista vacía', () => {
		expect(landingListOf([{ ...SECRETARIO, status: 'disabled' }])).toStrictEqual([]);
		expect(landingListOf([])).toStrictEqual([]);
	});

	it('ordena por nombre', () => {
		const names = landingListOf([
			{ ...SECRETARIO, slug: 'zeta', name: 'Zeta' },
			{ ...SECRETARIO, slug: 'alfa', name: 'Alfa' }
		]).map((app) => app.name);
		expect(names).toStrictEqual(['Alfa', 'Zeta']);
	});
});

describe('appPageOf (W02)', () => {
	it('app de escritorio con instalador de Windows: descarga disponible, ayuda de SmartScreen y alta con ?app=', () => {
		expect(appPageOf(SECRETARIO, 'soporte@mardomingo.com')).toStrictEqual({
			app: {
				slug: 'secretario',
				name: 'Secretario AI',
				description: 'Dicta y redacta con IA.',
				clientTypes: ['desktop'],
				download: { url: INSTALLER, available: true },
				access: null,
				externalLanding: null,
				smartScreenHelp: true
			},
			disabled: false,
			registerHref: '/registro?app=secretario',
			supportEmail: 'soporte@mardomingo.com'
		});
	});

	it('descarga no disponible: el bloque existe pero sin enlace', () => {
		const page = appPageOf(
			{ ...SECRETARIO, links: { landing: { type: 'internal' }, download_url: null } },
			'soporte@mardomingo.com'
		);
		expect(page.app.download).toStrictEqual({ url: null, available: false });
		expect(page.app.smartScreenHelp).toBe(false);
	});

	it('una app web con landing externa: acceso y enlace visibles, sin descarga', () => {
		const page = appPageOf(
			{
				...SECRETARIO,
				slug: 'web',
				clientTypes: ['web'],
				links: { landing: { type: 'external', url: 'https://web.example/' } }
			},
			'soporte@mardomingo.com'
		);
		expect(page.app.download).toBeNull();
		expect(page.app.access).toStrictEqual({ url: 'https://web.example/' });
		expect(page.app.externalLanding).toBe('https://web.example/');
	});

	it('app desactivada: sin descarga, sin acceso y sin «Crear cuenta»', () => {
		const page = appPageOf({ ...SECRETARIO, status: 'disabled' }, 'soporte@mardomingo.com');
		expect(page.disabled).toBe(true);
		expect(page.registerHref).toBeNull();
		expect(page.app.download).toBeNull();
		expect(page.app.access).toBeNull();
		expect(page.app.externalLanding).toBeNull();
		expect(page.app.smartScreenHelp).toBe(false);
	});

	it('el soporte propio de la app manda sobre el global', () => {
		expect(
			appPageOf(
				{ ...SECRETARIO, supportEmail: 'secretario@mardomingo.com' },
				'soporte@mardomingo.com'
			).supportEmail
		).toBe('secretario@mardomingo.com');
	});
});
