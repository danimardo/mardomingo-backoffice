// Generador de los tokens de COLOR de Cuenta Mardomingo (T454; ADR 0009, constitución principio XIII).
//
// Adaptado de `scripts/generate-tokens.mjs` del sistema de diseño del propietario: misma estructura (escalas de once
// pasos interpoladas en OKLCH entre anclas, alias semánticos por tema, verificación de contraste antes de escribir),
// con el VERDE SALVIA de la app como color de marca y sin el azul ni el naranja de la marca de origen.
//
// Qué hace, en este orden:
//   1. Construye las escalas (primary = verde salvia, accent = malva de énfasis, neutral, secondary, success, warning,
//      danger, info) a partir de sus anclas.
//   2. Define los tokens por tema (claro y oscuro): los semánticos del sistema (--surface, --text-*, --interactive-*,
//      --status-*…) y los nombres que ya usa la app (--color-text-primary, --color-accent, --surface-solid-card…) como
//      alias. Los tokens de CRISTAL y FONDO AMBIENTAL se conservan tal cual (T457 y T458 los rediseñan).
//   3. Comprueba todos los pares de contraste WCAG 2.2 AA en ambos temas (4,5:1 texto; 3:1 bordes de control, foco,
//      indicadores y bloques de color). Si uno falla, sale con código 1 y NO escribe nada.
//   4. Sustituye en `src/lib/design-system/tokens.css` SOLO la región entre `@generated:color:start` y
//      `@generated:color:end`, y formatea el fichero con Prettier. El resto del fichero se edita a mano.
//
// Uso:  pnpm tokens          verifica y escribe
//       pnpm tokens:check    verifica el contraste y que tokens.css coincide con lo generado (CI, puerta 10)
//       --verbose            lista todos los pares; --root <dir> lee y escribe el tokens.css de otra carpeta (pruebas)
import { readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import * as prettier from 'prettier';
import {
	STEPS,
	buildScale,
	composite,
	contrast,
	evaluate,
	mix,
	relLuminance
} from './tokens/color.mjs';

const REPO_ROOT = join(import.meta.dirname, '..');
const TOKENS = join('src', 'lib', 'design-system', 'tokens.css');
const args = process.argv.slice(2);
const rootIndex = args.indexOf('--root');
const ROOT = rootIndex >= 0 ? resolve(args[rootIndex + 1] ?? '.') : REPO_ROOT;
const CHECK = args.includes('--check');
const VERBOSE = args.includes('--verbose');

// ---------------------------------------------------------------- escalas
// Anclas: valores que se usan TAL CUAL; el resto de pasos se interpola en OKLCH.
const ANCHORS = {
	// Verde salvia de la app (Design/DESIGN_TOKENS.md): 600/700/800 son --color-accent, -hover y -active del tema claro
	// anterior (#11813F, #067A34, #006B2E) y 200/300/400 los del oscuro (#87C19E, #6BB287, #4C9C6B).
	primary: {
		50: '#F0F8F3',
		200: '#87C19E',
		300: '#6BB287',
		400: '#4C9C6B',
		600: '#11813F',
		700: '#067A34',
		800: '#006B2E',
		950: '#04200E'
	},
	// Gris acromático de apoyo (lo usa el catálogo); no es color de marca.
	secondary: {
		50: '#F6F6F6',
		100: '#EBEBEB',
		200: '#D6D6D6',
		300: '#B8B8B8',
		400: '#8F8F8F',
		500: '#6B6B6B',
		600: '#525252',
		700: '#3D3D3D',
		800: '#2E2E2E',
		900: '#1F1F1F',
		950: '#141414'
	},
	// Acento de énfasis: malva, la luz ambiental violeta de la app (--color-ambient oscuro #C48FDC en el 500). Solo para
	// destacados puntuales; nunca acción principal ni estado. Texto oscuro encima.
	accent: { 50: '#FAF5FC', 500: '#C48FDC', 950: '#1F0E28' },
	// Neutros fríos del sistema de diseño del propietario (escala completa).
	neutral: {
		50: '#F7F9FA',
		100: '#EEF2F4',
		200: '#DDE5E9',
		300: '#BDCBD2',
		400: '#91A3AD',
		500: '#667D89',
		600: '#4F6673',
		700: '#394E59',
		800: '#293A43',
		900: '#19282F',
		950: '#101A20'
	},
	// Éxito: oliva de la app (700 = #5A6B0C claro, 300 = #CFE07E oscuro). Un estado nunca se parece al verde de marca.
	success: { 50: '#F6F9E6', 300: '#CFE07E', 700: '#5A6B0C', 950: '#161B03' },
	// Advertencia y peligro: anclas del sistema de diseño del propietario.
	warning: { 50: '#FFF6E5', 300: '#F3C46E', 700: '#875400', 900: '#3B2C13', 950: '#241A0A' },
	danger: {
		50: '#FFF1F0',
		200: '#FFC1BC',
		300: '#FFA39B',
		600: '#B42318',
		700: '#912018',
		900: '#3E1D1B',
		950: '#2A0B07'
	},
	// Información: azul de la app (600 = #4661B8 claro, 300 = #8EA7FF oscuro), distinto del verde de marca.
	info: { 50: '#F0F4FF', 300: '#8EA7FF', 600: '#4661B8', 950: '#0C1433' }
};
const SCALE_NOTE = {
	primary: 'Verde salvia, color de marca: 600 claro y 300 oscuro son la acción principal',
	secondary: 'Gris acromático de apoyo',
	accent: 'Malva de énfasis (luz ambiental): solo destacados, con texto oscuro encima',
	neutral: 'Neutros fríos: texto, fondos y bordes',
	success: 'Éxito (oliva, distinto del verde de marca)',
	warning: 'Advertencia',
	danger: 'Error y peligro',
	info: 'Información (azul)'
};
/** @type {Record<string, Record<number, string>>} */
const ramps = Object.fromEntries(Object.entries(ANCHORS).map(([k, v]) => [k, buildScale(v)]));
const SCALE_ORDER = Object.keys(ANCHORS);

// Superficies oscuras intermedias que no caen en la escala neutral.
const EXTRA_PRIMITIVES = {
	'neutral-850': ['#263943', 'superficie hundida intermedia (oscuro)'],
	'neutral-875': ['#20313A', 'tarjetas y superpuestos (oscuro)'],
	'neutral-925': ['#17232B', 'fondo de página (oscuro)']
};

/** @type {Record<string, string>} */
const prim = { 'color-white': '#FFFFFF', 'color-black': '#101A20' };
for (const scale of SCALE_ORDER)
	for (const step of STEPS) prim[`${scale}-${step}`] = ramps[scale]?.[step] ?? '';
for (const [name, [hex]] of Object.entries(EXTRA_PRIMITIVES)) prim[name] = hex;

// ---------------------------------------------------------------- tokens por tema
// Valor: 'nombre' (=> var(--nombre), otro token o una primitiva), '#hex' literal, o { css, hex? } para expresiones
// (hex: el color resuelto, si se comprueba su contraste).
/** @typedef {string | { css: string, hex?: string }} TokenValue */

/** @param {string} percent @param {string} token */
const tint = (token, percent) => ({
	css: `color-mix(in srgb, var(--${token}) ${percent}, transparent)`
});

// Paleta categórica (gráficas): 12 series con distancia de matiz validada por el sistema de origen; la 1 es el verde
// de marca, la 2 y la 3 son las series violeta y naranja que ya tenía la app (--color-chart-a-b y --color-chart-b-a).
const CHART = {
	light: [
		'primary-600',
		'#7351C9',
		'#C3670E',
		'#006E89',
		'#B42318',
		'#51697B',
		'#A33978',
		'#39787A',
		'#C24973',
		'#8D7100',
		'#118376',
		'#586DD4'
	],
	dark: [
		'primary-300',
		'#B9A2FF',
		'#F0A868',
		'#7DCDDF',
		'#FFA39B',
		'#AAB7BF',
		'#F2ABD1',
		'#8BD3CC',
		'#FE9CB8',
		'#D9BB5C',
		'#50D7C3',
		'#A7BAFF'
	]
};

// Iconografía Claymorphism del catálogo: escala de volumen por tono semántico.
const CLAY_TONES = {
	neutral: {
		light: {
			light: 'neutral-200',
			base: 'neutral-500',
			shade: 'neutral-700',
			detail: 'color-white',
			shadow: 'neutral-950'
		},
		dark: {
			light: 'color-white',
			base: 'neutral-200',
			shade: 'neutral-400',
			detail: 'color-black',
			shadow: 'color-black'
		}
	},
	primary: {
		light: {
			light: 'primary-200',
			base: 'primary-600',
			shade: 'primary-800',
			detail: 'color-white',
			shadow: 'primary-950'
		},
		dark: {
			light: 'color-white',
			base: 'primary-200',
			shade: 'primary-400',
			detail: 'color-black',
			shadow: 'color-black'
		}
	},
	success: {
		light: {
			light: 'success-200',
			base: 'success-600',
			shade: 'success-800',
			detail: 'color-white',
			shadow: 'success-950'
		},
		dark: {
			light: 'color-white',
			base: 'success-200',
			shade: 'success-400',
			detail: 'color-black',
			shadow: 'color-black'
		}
	},
	warning: {
		light: {
			light: 'warning-200',
			base: 'warning-600',
			shade: 'warning-800',
			detail: 'color-white',
			shadow: 'warning-950'
		},
		dark: {
			light: 'color-white',
			base: 'warning-200',
			shade: 'warning-400',
			detail: 'color-black',
			shadow: 'color-black'
		}
	},
	danger: {
		light: {
			light: 'danger-200',
			base: 'danger-500',
			shade: 'danger-700',
			detail: 'color-white',
			shadow: 'danger-950'
		},
		dark: {
			light: 'color-white',
			base: 'danger-200',
			shade: 'danger-400',
			detail: 'color-black',
			shadow: 'color-black'
		}
	},
	info: {
		light: {
			light: 'info-200',
			base: 'info-600',
			shade: 'info-800',
			detail: 'color-white',
			shadow: 'info-950'
		},
		dark: {
			light: 'color-white',
			base: 'info-200',
			shade: 'info-400',
			detail: 'color-black',
			shadow: 'color-black'
		}
	},
	accent: {
		light: {
			light: 'accent-200',
			base: 'accent-600',
			shade: 'accent-800',
			detail: 'color-white',
			shadow: 'accent-950'
		},
		dark: {
			light: 'color-white',
			base: 'accent-200',
			shade: 'accent-400',
			detail: 'color-black',
			shadow: 'color-black'
		}
	}
};

// Cristal y fondo ambiental de la app: se conservan TAL CUAL (T457 fondo ambiental, T458 cristal). Ver el comentario
// de la región generada en tokens.css.
const PRESERVED = {
	light: {
		'color-ambient': '#d2a3df',
		'sidebar-bg': 'rgba(246, 248, 252, 0.76)',
		'sidebar-border': 'rgba(46, 71, 52, 0.08)',
		'surface-secondary': 'rgba(255, 255, 255, 0.62)',
		'surface-secondary-hover': 'rgba(255, 255, 255, 0.82)',
		'pill-bg': 'rgba(255, 255, 255, 0.7)',
		'pill-border': 'rgba(46, 83, 54, 0.12)',
		'border-card-hero': 'rgba(46, 83, 54, 0.12)',
		'border-dialog': 'rgba(46, 83, 54, 0.1)',
		'surface-field': 'rgba(255, 255, 255, 0.68)',
		'surface-field-hover': 'rgba(255, 255, 255, 0.86)',
		'surface-field-disabled': 'rgba(46, 83, 54, 0.05)',
		'border-button-primary': 'rgba(255, 255, 255, 0.3)',
		'gradient-app-bg':
			'radial-gradient(55% 65% at 92% 100%, rgba(56, 132, 49, 0.22) 0%, rgba(93, 155, 97, 0.12) 38%, transparent 72%), radial-gradient(58% 42% at 38% 108%, rgba(213, 156, 233, 0.36) 0%, rgba(218, 181, 232, 0.18) 40%, transparent 74%), radial-gradient(45% 55% at 105% 5%, rgba(122, 182, 148, 0.22) 0%, transparent 70%), linear-gradient(135deg, #f7f9fd 0%, #f0f2f9 45%, #e9ecf7 72%, #f2f0f8 100%)',
		'gradient-blob-1':
			'linear-gradient(135deg, rgba(201, 172, 233, 0.55), rgba(232, 191, 242, 0.7))',
		'blob-1-opacity': '0.55',
		'gradient-blob-2':
			'radial-gradient(circle at 35% 20%, #d6ddf8 0%, #a5cbac 36%, #65a371 68%, #307d3d 100%)',
		'blob-2-opacity': '0.42',
		'shadow-blob-2':
			'inset 0 2px 0 rgba(255, 255, 255, 0.55), 0 -10px 40px rgba(48, 125, 61, 0.14)',
		'gradient-titlebar': 'linear-gradient(90deg, #ffffff 0%, #f4f5fd 55%, #e9ebfc 100%)',
		'gradient-card-default':
			'linear-gradient(135deg, rgba(255, 255, 255, 0.76), rgba(245, 246, 254, 0.64))',
		'gradient-card-default-hover':
			'linear-gradient(135deg, rgba(255, 255, 255, 0.88), rgba(247, 248, 255, 0.78))',
		'shadow-card-default':
			'inset 0 1px 0 rgba(255, 255, 255, 0.85), 0 12px 30px rgba(32, 63, 39, 0.08)',
		'gradient-card-selected':
			'linear-gradient(135deg, rgba(239, 241, 255, 0.94), rgba(223, 228, 255, 0.82))',
		'shadow-card-selected': '0 8px 28px rgba(41, 111, 62, 0.12)',
		'gradient-card-hero':
			'linear-gradient(115deg, rgba(255, 255, 255, 0.9) 0%, rgba(244, 245, 254, 0.86) 48%, rgba(229, 233, 252, 0.8) 100%)',
		'shadow-card-hero': 'inset 0 1px 0 rgba(255, 255, 255, 0.9), 0 20px 50px rgba(32, 63, 39, 0.1)',
		'gradient-dialog':
			'linear-gradient(160deg, rgba(255, 255, 255, 0.95), rgba(245, 246, 254, 0.98))',
		'shadow-dialog': '0 30px 70px rgba(32, 63, 39, 0.22), inset 0 1px 0 rgba(255, 255, 255, 0.7)',
		'material-saturate': '130%'
	},
	dark: {
		'color-ambient': '#c48fdc',
		'sidebar-bg': 'rgba(6, 22, 36, 0.78)',
		'sidebar-border': 'rgba(188, 201, 237, 0.09)',
		'surface-secondary': 'rgba(26, 42, 62, 0.58)',
		'surface-secondary-hover': 'rgba(51, 61, 48, 0.72)',
		'pill-bg': 'rgba(54, 67, 95, 0.58)',
		'pill-border': 'rgba(199, 217, 203, 0.15)',
		'border-card-hero': 'rgba(182, 206, 185, 0.16)',
		'border-dialog': 'rgba(193, 211, 195, 0.14)',
		'surface-field': 'rgba(18, 32, 49, 0.62)',
		'surface-field-hover': 'rgba(23, 41, 61, 0.72)',
		'surface-field-disabled': 'rgba(18, 32, 49, 0.32)',
		'border-button-primary': 'rgba(255, 255, 255, 0.14)',
		'gradient-app-bg':
			'radial-gradient(55% 65% at 92% 100%, rgba(57, 89, 9, 0.55) 0%, rgba(41, 70, 17, 0.3) 35%, transparent 72%), radial-gradient(58% 42% at 38% 108%, rgba(194, 136, 224, 0.45) 0%, rgba(73, 120, 108, 0.24) 38%, transparent 73%), radial-gradient(45% 55% at 105% 5%, rgba(75, 131, 111, 0.22) 0%, transparent 70%), radial-gradient(45% 50% at 45% 40%, rgba(83, 99, 77, 0.16) 0%, transparent 72%), linear-gradient(135deg, #061828 0%, #0d1f30 42%, #1b2943 72%, #222c4b 100%)',
		'gradient-blob-1': 'linear-gradient(135deg, rgba(46, 96, 72, 0.85), rgba(205, 137, 223, 0.55))',
		'blob-1-opacity': '0.65',
		'gradient-blob-2':
			'radial-gradient(circle at 35% 20%, #a1b9a5 0%, #527849 34%, #304a0e 67%, #1c2f07 100%)',
		'blob-2-opacity': '0.85',
		'shadow-blob-2': 'inset 0 2px 0 rgba(255, 255, 255, 0.14), 0 -10px 60px rgba(55, 89, 29, 0.22)',
		'gradient-titlebar': 'linear-gradient(90deg, #091d2c 0%, #182c42 50%, #2b4437 100%)',
		'gradient-card-default':
			'linear-gradient(135deg, rgba(26, 45, 65, 0.86), rgba(43, 59, 85, 0.74))',
		'gradient-card-default-hover':
			'linear-gradient(135deg, rgba(31, 51, 76, 0.94), rgba(62, 75, 60, 0.82))',
		'shadow-card-default':
			'inset 0 1px 0 rgba(255, 255, 255, 0.035), 0 8px 24px rgba(0, 0, 0, 0.12)',
		'gradient-card-selected':
			'linear-gradient(135deg, rgba(25, 47, 78, 0.92), rgba(54, 71, 51, 0.82))',
		'shadow-card-selected': '0 0 0 1px rgba(107, 178, 135, 0.1), 0 12px 30px rgba(36, 71, 41, 0.2)',
		'gradient-card-hero':
			'linear-gradient(115deg, rgba(15, 33, 50, 0.92) 0%, rgba(49, 58, 44, 0.82) 48%, rgba(67, 84, 63, 0.7) 100%)',
		'shadow-card-hero': 'inset 0 1px 0 rgba(255, 255, 255, 0.05), 0 20px 50px rgba(0, 0, 0, 0.28)',
		'gradient-dialog': 'linear-gradient(160deg, rgba(27, 44, 70, 0.94), rgba(18, 32, 53, 0.96))',
		'shadow-dialog': '0 30px 70px rgba(0, 0, 0, 0.45), inset 0 1px 0 rgba(255, 255, 255, 0.05)',
		'material-saturate': '150%'
	}
};

/** @type {Record<'light' | 'dark', Record<string, TokenValue>>} */
const THEMES = {
	light: {
		// Superficies: página, tarjeta, hundida (campos, cabeceras de tabla) y superpuesta (menús, diálogos).
		surface: 'neutral-50',
		'surface-raised': 'color-white',
		'surface-sunken': 'neutral-100',
		'surface-overlay': 'color-white',
		'text-primary': 'neutral-900',
		'text-secondary': '#4B565E',
		'text-muted': '#5A6670',
		'text-disabled': '#84929B',
		border: '#CDD7DE',
		'border-subtle': { css: 'color-mix(in srgb, var(--border) 55%, transparent)' },
		'border-strong': '#6A7882',
		// Acción principal: relleno 600; texto de enlace 800 (llega a 4,5:1 también sobre la superficie hundida y sobre el
		// cristal de las tarjetas seleccionada y destacada, que tiñen de azul el fondo).
		'interactive-primary': 'primary-600',
		'interactive-hover': 'primary-700',
		'interactive-active': 'primary-800',
		'text-interactive': 'primary-800',
		'text-interactive-hover': 'primary-900',
		focus: 'primary-600',
		'surface-button-primary': 'primary-600',
		'color-on-primary': 'color-white',
		'status-success': 'success-700',
		'status-warning': 'warning-700',
		'status-danger': 'danger-600',
		'status-info': 'info-600',
		'text-success': 'success-700',
		'text-warning': 'warning-700',
		'text-danger': 'danger-600',
		'text-info': 'info-600',
		'color-on-danger': 'color-white',
		'surface-button-danger-hover': 'danger-700',
		// Acento de énfasis (malva).
		'text-accent': 'accent-700',
		'indicator-accent': 'accent-600',
		'surface-button-accent': 'accent-500',
		'color-on-accent': 'neutral-900',
		'accent-hover': 'accent-400',
		'accent-active': 'accent-300',
		'border-button-accent': 'accent-600',
		'surface-accent-subtle': { css: 'color-mix(in srgb, var(--accent-500) 18%, var(--surface))' },
		'overlay-backdrop': 'rgba(16, 26, 32, 0.48)',
		'glass-border': 'rgba(16, 26, 32, 0.1)',
		'shadow-flat': 'none',
		'shadow-raised': '0 1px 0 rgba(255, 255, 255, 0.7) inset, 0 2px 8px rgba(16, 26, 32, 0.08)',
		'shadow-floating': '0 8px 24px rgba(16, 26, 32, 0.12)',
		'shadow-overlay': '0 12px 32px rgba(16, 26, 32, 0.14)',
		'shadow-modal': '0 16px 48px rgba(16, 26, 32, 0.18), 0 1px 0 rgba(255, 255, 255, 0.8) inset',
		'absence-holiday-bg': { css: 'color-mix(in srgb, var(--danger-200) 45%, var(--surface))' },
		'absence-no-service-bg': { css: 'color-mix(in srgb, var(--neutral-300) 45%, var(--surface))' },
		'employee-on-color': 'color-white',
		// --- Nombres que ya usa la app (alias de los semánticos) ---
		'color-bg-base': 'surface',
		'color-bg-main': 'surface',
		'color-bg-elevated': 'surface-raised',
		'color-text-primary': 'text-primary',
		'color-text-secondary': 'text-secondary',
		'color-text-tertiary': 'text-muted',
		'color-text-muted': 'text-muted',
		'color-text-disabled': 'text-disabled',
		'color-accent': 'text-interactive',
		'color-accent-hover': 'text-interactive-hover',
		'color-accent-active': 'interactive-active',
		'border-default': 'border',
		'border-hover': 'border-strong',
		'border-accent-strong': 'interactive-primary',
		'color-success': 'status-success',
		'color-warning': 'status-warning',
		'color-danger': 'status-danger',
		'color-info': 'status-info',
		'color-success-soft': tint('status-success', '12%'),
		'color-warning-soft': tint('status-warning', '12%'),
		'color-danger-soft': tint('status-danger', '12%'),
		'color-info-soft': tint('status-info', '12%'),
		'titlebar-border': 'border-subtle',
		'window-border': 'border-subtle',
		'color-winctrl-icon': 'text-secondary',
		'winctrl-hover-bg': tint('interactive-primary', '12%'),
		'winctrl-close-hover-bg': 'status-danger',
		'winctrl-close-hover-text': 'color-on-danger',
		'hover-tint': tint('text-primary', '5%'),
		'icon-chip-bg': tint('text-primary', '7%'),
		'color-nav-active-text': 'color-on-primary',
		'color-button-primary-text': 'color-on-primary',
		'overlay-scrim': 'overlay-backdrop',
		'border-field': 'border-strong',
		'border-field-hover': 'text-secondary',
		'border-field-focus': 'focus',
		'border-field-error': 'status-danger',
		'color-field-placeholder': 'text-muted',
		'color-focus-ring': 'focus',
		'color-focus': 'focus',
		'surface-solid-chrome': 'surface',
		'surface-solid-card': 'surface-raised',
		'surface-solid-overlay': 'surface-overlay',
		'surface-solid-pill': 'surface-raised',
		'color-chart-a-b': 'chart-2',
		'color-chart-b-a': 'chart-3',
		'color-chart-grid': tint('text-primary', '8%'),
		'color-chart-warmup-zone': tint('text-primary', '3%'),
		'color-chart-cooldown-zone': tint('text-primary', '2%'),
		'color-chart-axis-label': 'text-muted',
		'color-chart-gap': 'text-disabled',
		'shadow-sm': 'shadow-raised',
		'shadow-md': 'shadow-floating',
		'shadow-lg': 'shadow-modal',
		'gradient-brand-mark': {
			css: 'radial-gradient(circle at 35% 30%, var(--primary-300), var(--primary-800))'
		},
		'gradient-nav-active': {
			css: 'linear-gradient(135deg, var(--primary-600), var(--primary-800))'
		},
		'shadow-nav-active': {
			css: '0 6px 18px color-mix(in srgb, var(--primary-700) 18%, transparent)'
		},
		'gradient-button-primary': {
			css: 'linear-gradient(135deg, var(--primary-600) 0%, var(--primary-700) 50%, var(--primary-800) 100%)'
		},
		'gradient-button-primary-hover': {
			css: 'linear-gradient(135deg, var(--primary-700) 0%, var(--primary-800) 50%, var(--primary-900) 100%)'
		},
		'shadow-button-primary': {
			css: '0 10px 26px color-mix(in srgb, var(--primary-700) 28%, transparent)'
		},
		'shadow-button-primary-hover': {
			css: '0 14px 32px color-mix(in srgb, var(--primary-700) 34%, transparent)'
		},
		'shadow-button-primary-active': {
			css: '0 5px 14px color-mix(in srgb, var(--primary-700) 22%, transparent)'
		},
		'shadow-field-focus': { css: '0 0 0 3px color-mix(in srgb, var(--focus) 18%, transparent)' },
		'shadow-field-error': {
			css: '0 0 0 3px color-mix(in srgb, var(--status-danger) 16%, transparent)'
		},
		...PRESERVED.light
	},
	dark: {
		surface: 'neutral-925',
		'surface-raised': 'neutral-875',
		'surface-sunken': 'neutral-950',
		'surface-overlay': 'neutral-875',
		'text-primary': '#F4F6F8',
		'text-secondary': '#C3CDD3',
		'text-muted': '#AAB7BF',
		'text-disabled': '#82929C',
		border: '#3A4C57',
		'border-subtle': { css: 'color-mix(in srgb, var(--border) 55%, transparent)' },
		'border-strong': '#7E919C',
		'interactive-primary': 'primary-300',
		'interactive-hover': 'primary-200',
		'interactive-active': 'primary-400',
		// Enlace 200 (no 300): llega a 4,5:1 sobre el cristal de las tarjetas oscuras.
		'text-interactive': 'primary-200',
		'text-interactive-hover': 'primary-100',
		focus: 'primary-300',
		'surface-button-primary': 'primary-300',
		'color-on-primary': 'color-black',
		'status-success': 'success-300',
		'status-warning': 'warning-300',
		'status-danger': 'danger-300',
		'status-info': 'info-300',
		'text-success': 'success-300',
		'text-warning': 'warning-300',
		'text-danger': 'danger-300',
		'text-info': 'info-300',
		'color-on-danger': '#3A0D08',
		'surface-button-danger-hover': 'danger-200',
		'text-accent': 'accent-300',
		'indicator-accent': 'accent-500',
		'surface-button-accent': 'accent-500',
		'color-on-accent': 'color-black',
		'accent-hover': 'accent-400',
		'accent-active': 'accent-300',
		'border-button-accent': 'accent-500',
		'surface-accent-subtle': { css: 'color-mix(in srgb, var(--accent-500) 18%, var(--surface))' },
		'overlay-backdrop': 'rgba(0, 0, 0, 0.64)',
		'glass-border': 'rgba(255, 255, 255, 0.14)',
		'shadow-flat': 'none',
		'shadow-raised': '0 1px 0 rgba(255, 255, 255, 0.03) inset, 0 2px 8px rgba(0, 0, 0, 0.24)',
		'shadow-floating': '0 8px 24px rgba(0, 0, 0, 0.32)',
		'shadow-overlay': '0 12px 32px rgba(0, 0, 0, 0.36)',
		'shadow-modal': '0 16px 48px rgba(0, 0, 0, 0.4), 0 1px 0 rgba(255, 255, 255, 0.05) inset',
		'absence-holiday-bg': { css: 'color-mix(in srgb, var(--danger-800) 45%, var(--surface))' },
		'absence-no-service-bg': { css: 'color-mix(in srgb, var(--neutral-700) 45%, var(--surface))' },
		'employee-on-color': 'color-black',
		'surface-solid-pill': 'neutral-850',
		'gradient-brand-mark': {
			css: 'radial-gradient(circle at 35% 30%, var(--primary-200), var(--primary-600))'
		},
		'gradient-nav-active': {
			css: 'linear-gradient(135deg, var(--primary-300), var(--primary-400))'
		},
		'shadow-nav-active': 'inset 0 1px 0 rgba(255, 255, 255, 0.08)',
		'gradient-button-primary': {
			css: 'linear-gradient(135deg, var(--primary-200) 0%, var(--primary-300) 50%, var(--primary-400) 100%)'
		},
		'gradient-button-primary-hover': {
			css: 'linear-gradient(135deg, var(--primary-100) 0%, var(--primary-200) 50%, var(--primary-300) 100%)'
		},
		'shadow-button-primary': {
			css: '0 10px 28px color-mix(in srgb, var(--primary-400) 30%, transparent), inset 0 1px 0 rgba(255, 255, 255, 0.28)'
		},
		'shadow-button-primary-hover': {
			css: '0 14px 36px color-mix(in srgb, var(--primary-400) 38%, transparent)'
		},
		'shadow-button-primary-active': {
			css: '0 5px 16px color-mix(in srgb, var(--primary-400) 24%, transparent)'
		},
		...PRESERVED.dark
	}
};
for (const theme of /** @type {const} */ (['light', 'dark'])) {
	CHART[theme].forEach((value, i) => {
		THEMES[theme][`chart-${i + 1}`] = value;
	});
	for (const [tone, spec] of Object.entries(CLAY_TONES)) {
		for (const [slot, ref] of Object.entries(spec[theme]))
			THEMES[theme][`icon-clay-${tone}-${slot}`] = ref;
	}
	for (const slot of ['light', 'base', 'shade', 'detail', 'shadow']) {
		THEMES[theme][`icon-clay-${slot}`] = `icon-clay-primary-${slot}`;
	}
}

// ---------------------------------------------------------------- resolución
/** @param {'light' | 'dark'} theme */
function resolver(theme) {
	const tokens = { ...THEMES.light, ...THEMES[theme] };
	/** @param {string} name @param {string[]} [seen] @returns {string} */
	const resolve = (name, seen = []) => {
		if (seen.includes(name)) throw new Error(`Referencia circular: ${[...seen, name].join(' → ')}`);
		const value = tokens[name];
		if (value === undefined) {
			const primitive = prim[name];
			if (!primitive) throw new Error(`No se puede resolver --${name} en ${theme}`);
			return primitive;
		}
		if (typeof value !== 'string') {
			if (value.hex) return value.hex;
			throw new Error(`--${name} no tiene un color resoluble en ${theme}`);
		}
		if (value.startsWith('#')) return value.toUpperCase();
		if (/^(rgba?\(|none|\d)/.test(value))
			throw new Error(`--${name} no es un color opaco en ${theme}`);
		return resolve(value, [...seen, name]);
	};
	return resolve;
}

/** Valor CSS de un token. @param {TokenValue} value */
const cssValue = (value) => {
	if (typeof value !== 'string') return value.css;
	if (value.startsWith('#') || /^(rgba?\(|none$|inset |\d|-|radial-|linear-)/.test(value))
		return value;
	return `var(--${value})`;
};

// ---------------------------------------------------------------- verificación
/** @type {import('./tokens/color.mjs').Pair[]} */
const pairs = [];
/** @param {string} theme @param {string} label @param {string} fg @param {string} bg @param {number} min */
const pair = (theme, label, fg, bg, min) => pairs.push({ theme, label, fg, bg, min });
/** Pares informativos: se listan como AVISO, no hacen fallar la verificación. @type {import('./tokens/color.mjs').Pair[]} */
const warnings = [];
/** @param {string} theme @param {string} label @param {string} fg @param {string} bg @param {number} min */
const warn = (theme, label, fg, bg, min) => warnings.push({ theme, label, fg, bg, min });

const SURFACES = [
	'surface',
	'surface-raised',
	'surface-sunken',
	'surface-overlay',
	'surface-solid-pill'
];
const TEXT = [
	'text-primary',
	'text-secondary',
	'text-muted',
	'text-interactive',
	'text-interactive-hover',
	'text-success',
	'text-warning',
	'text-danger',
	'text-info',
	'text-accent',
	'status-success',
	'status-warning',
	'status-danger',
	'status-info'
];
const NON_TEXT = [
	'border-strong',
	'border-field-hover',
	'focus',
	'interactive-primary',
	'indicator-accent'
];

/** Paradas de color (rgba o hex) de un degradado o de un color. @param {string} css */
const colorStops = (css) => [...css.matchAll(/rgba?\([^)]*\)|#[0-9a-fA-F]{6}\b/g)].map((m) => m[0]);

/** `saturate(s)` de CSS sobre un color opaco. @param {string} hex @param {number} s */
function saturate(hex, s) {
	const n = hex.replace('#', '');
	const [r, g, b] = [0, 2, 4].map((i) => parseInt(n.slice(i, i + 2), 16) / 255);
	const R = r ?? 0;
	const G = g ?? 0;
	const B = b ?? 0;
	/** @param {number} v */
	const hex2 = (v) =>
		Math.round(Math.min(1, Math.max(0, v)) * 255)
			.toString(16)
			.padStart(2, '0');
	return (
		'#' +
		hex2((0.213 + 0.787 * s) * R + (0.715 - 0.715 * s) * G + (0.072 - 0.072 * s) * B) +
		hex2((0.213 - 0.213 * s) * R + (0.715 + 0.285 * s) * G + (0.072 - 0.072 * s) * B) +
		hex2((0.213 - 0.213 * s) * R + (0.715 - 0.715 * s) * G + (0.072 + 0.928 * s) * B)
	).toUpperCase();
}

for (const theme of /** @type {const} */ (['light', 'dark'])) {
	const R = resolver(theme);
	for (const surface of SURFACES) {
		for (const text of TEXT) pair(theme, `${text} / ${surface}`, R(text), R(surface), 4.5);
		for (const ui of NON_TEXT) pair(theme, `${ui} / ${surface} (no textual)`, R(ui), R(surface), 3);
	}
	// Botón primario: texto sobre cada parada de los degradados y sobre los rellenos de estado.
	for (const name of [
		'gradient-button-primary',
		'gradient-button-primary-hover',
		'gradient-nav-active'
	]) {
		const value = THEMES[theme][name];
		const css = typeof value === 'string' ? value : (value?.css ?? '');
		for (const [, step] of css.matchAll(/var\(--(primary-\d+)\)/g)) {
			pair(
				theme,
				`color-on-primary / ${name} (${step})`,
				R('color-on-primary'),
				R(step ?? ''),
				4.5
			);
		}
	}
	for (const bg of ['surface-button-primary', 'interactive-hover', 'interactive-active']) {
		pair(theme, `color-on-primary / ${bg} (botón primario)`, R('color-on-primary'), R(bg), 4.5);
	}
	for (const bg of ['status-danger', 'surface-button-danger-hover']) {
		pair(theme, `color-on-danger / ${bg} (botón de peligro)`, R('color-on-danger'), R(bg), 4.5);
	}
	for (const bg of ['surface-button-accent', 'accent-hover', 'accent-active']) {
		pair(theme, `color-on-accent / ${bg} (botón de énfasis)`, R('color-on-accent'), R(bg), 4.5);
	}
	for (const surface of ['surface', 'surface-raised']) {
		pair(
			theme,
			`border-button-accent / ${surface} (borde)`,
			R('border-button-accent'),
			R(surface),
			3
		);
		pair(theme, `neutral-500 (pista apagada) / ${surface}`, R('neutral-500'), R(surface), 3);
		const subtle = mix(R('accent-500'), 0.18, R(surface));
		pair(theme, `text-primary / acento 18 % sobre ${surface}`, R('text-primary'), subtle, 4.5);
		// Avisos: fondo del estado al 12 % sobre la superficie, con el texto del estado y el principal.
		for (const tone of ['success', 'warning', 'danger', 'info']) {
			const soft = mix(R(`status-${tone}`), 0.12, R(surface));
			pair(
				theme,
				`text-${tone} / color-${tone}-soft sobre ${surface}`,
				R(`text-${tone}`),
				soft,
				4.5
			);
			pair(
				theme,
				`text-primary / color-${tone}-soft sobre ${surface}`,
				R('text-primary'),
				soft,
				4.5
			);
		}
	}
	// Series de gráficas: bloque de color frente a las superficies.
	for (let n = 1; n <= CHART.light.length; n++) {
		for (const surface of ['surface', 'surface-raised', 'surface-sunken']) {
			pair(theme, `chart-${n} / ${surface} (serie)`, R(`chart-${n}`), R(surface), 3);
		}
	}
	// Calendario de ausencias del catálogo.
	const holiday =
		theme === 'light'
			? mix(R('danger-200'), 0.45, R('surface'))
			: mix(R('danger-800'), 0.45, R('surface'));
	const noService =
		theme === 'light'
			? mix(R('neutral-300'), 0.45, R('surface'))
			: mix(R('neutral-700'), 0.45, R('surface'));
	pair(theme, 'text-primary / absence-holiday-bg', R('text-primary'), holiday, 4.5);
	pair(theme, 'text-primary / absence-no-service-bg', R('text-primary'), noService, 4.5);
	// Iconos Claymorphism del catálogo: cuerpo y canto a 3:1 de las superficies; detalle a 3:1 del cuerpo.
	for (const tone of Object.keys(CLAY_TONES)) {
		for (const surface of SURFACES.slice(0, 4)) {
			pair(
				theme,
				`icon-clay-${tone}-base / ${surface}`,
				R(`icon-clay-${tone}-base`),
				R(surface),
				3
			);
			pair(
				theme,
				`icon-clay-${tone}-shade / ${surface}`,
				R(`icon-clay-${tone}-shade`),
				R(surface),
				3
			);
		}
		const detail = R(`icon-clay-${tone}-detail`);
		pair(theme, `icon-clay-${tone}-detail / base`, detail, R(`icon-clay-${tone}-base`), 3);
		pair(theme, `icon-clay-${tone}-detail / shade`, detail, R(`icon-clay-${tone}-shade`), 3);
	}

	// Cristal conservado (T458) sobre el fondo ambiental conservado (T457): cada superficie translúcida pintada sobre
	// las paradas del color base del fondo, con y sin la saturación del filtro (OBLIGATORIO), y sobre cada mancha de luz
	// a su opacidad máxima (AVISO: cota pesimista; el cristal y el fondo no se tocan en T454 y la medida sobre la
	// composición real es DS-09, T462).
	const preserved = PRESERVED[theme];
	const appBg = preserved['gradient-app-bg'];
	const base = colorStops(/linear-gradient\([^)]*\)$/.exec(appBg)?.[0] ?? '');
	const blobs = [...appBg.matchAll(/radial-gradient\([^,]+,\s*(rgba\([^)]*\))/g)].map(
		(m) => m[1] ?? ''
	);
	const blobGrounds = base.flatMap((stop) => blobs.map((blob) => composite(blob, stop)));
	const saturation = Number.parseFloat(preserved['material-saturate']) / 100;
	const GLASS = [
		'surface-secondary',
		'surface-secondary-hover',
		'surface-field',
		'surface-field-hover',
		'pill-bg',
		'sidebar-bg',
		'gradient-card-default',
		'gradient-card-default-hover',
		'gradient-card-selected',
		'gradient-card-hero',
		'gradient-dialog'
	];
	/** @param {string} glass @param {string[]} grounds */
	const glassOver = (glass, grounds) =>
		colorStops(preserved[/** @type {keyof typeof preserved} */ (glass)]).flatMap((stop) =>
			grounds.flatMap((ground) => [
				composite(stop, ground),
				composite(stop, saturate(ground, saturation))
			])
		);
	/** @param {string} fg @param {string[]} backgrounds */
	const worstOf = (fg, backgrounds) =>
		backgrounds.reduce((w, bg) => (contrast(fg, bg) < contrast(fg, w) ? bg : w));
	for (const glass of GLASS) {
		const onBase = glassOver(glass, base);
		const onBlobs = glassOver(glass, blobGrounds);
		for (const text of [
			'text-primary',
			'text-secondary',
			'text-muted',
			'text-interactive',
			'text-danger'
		]) {
			const label = `${text} / ${glass} sobre el fondo ambiental`;
			pair(theme, label, R(text), worstOf(R(text), onBase), 4.5);
			warn(theme, `${label} (mancha de luz)`, R(text), worstOf(R(text), onBlobs), 4.5);
		}
		if (glass.startsWith('surface-field')) {
			for (const ui of ['border-strong', 'focus']) {
				const label = `${ui} / ${glass} sobre el fondo ambiental (control)`;
				pair(theme, label, R(ui), worstOf(R(ui), onBase), 3);
				warn(theme, `${label} (mancha de luz)`, R(ui), worstOf(R(ui), onBlobs), 3);
			}
		}
	}
}
// Invariantes: texto blanco sobre rellenos sólidos del catálogo (Badge, Timeline, AvatarGroup).
for (const step of ['success-800', 'warning-800', 'danger-600', 'info-600', 'neutral-600']) {
	pair(
		'ambos',
		`color-white / ${step} (relleno sólido)`,
		prim['color-white'] ?? '',
		prim[step] ?? '',
		4.5
	);
}
// Emails transaccionales (sin variables CSS: la plantilla lee estos hex al compilar).
const EMAIL = {
	'email-action-bg': '#3f6b5a',
	'email-action-text': '#ffffff',
	'email-dark-bg': '#1b1f1d',
	'email-dark-text': '#e8ece9'
};
pair(
	'email',
	'email-action-text / email-action-bg',
	EMAIL['email-action-text'],
	EMAIL['email-action-bg'],
	4.5
);
pair(
	'email',
	'email-dark-text / email-dark-bg',
	EMAIL['email-dark-text'],
	EMAIL['email-dark-bg'],
	4.5
);

const results = evaluate(pairs);

// Monotonía de las escalas: cada paso más oscuro que el anterior.
const notMonotonic = [];
for (const scale of SCALE_ORDER) {
	for (let i = 1; i < STEPS.length; i++) {
		const step = STEPS[i] ?? 0;
		const previous = STEPS[i - 1] ?? 0;
		if (relLuminance(ramps[scale]?.[step] ?? '') >= relLuminance(ramps[scale]?.[previous] ?? '')) {
			notMonotonic.push(`${scale}-${step}`);
		}
	}
}

const failures = results.filter((r) => !r.ok);
/** @param {import('./tokens/color.mjs').PairResult} r */
const line = (r) =>
	`${r.ok ? 'OK ' : 'NO '} [${r.theme}] ${r.label}: ${r.ratio.toFixed(2)}:1 (mín. ${r.min}:1) [${r.fg} sobre ${r.bg}]`;
if (VERBOSE) for (const r of results) console.log(line(r));
for (const r of failures) console.error(line(r));
if (notMonotonic.length) console.error(`Escalas no monótonas en: ${notMonotonic.join(', ')}`);

const minText = Math.min(...results.filter((r) => r.min === 4.5).map((r) => r.ratio));
const minUi = Math.min(...results.filter((r) => r.min === 3).map((r) => r.ratio));
console.log(
	`${results.length} pares comprobados — ${failures.length} fallos. Mínimo en texto ${minText.toFixed(2)}:1; ` +
		`mínimo no textual ${minUi.toFixed(2)}:1.`
);
// Avisos: el cristal y el fondo ambiental conservados sobre las manchas de luz (los rediseñan T457 y T458; la medida real es T462).
const warned = evaluate(warnings).filter((r) => VERBOSE || !r.ok);
if (warned.length) {
	console.log(
		`Avisos (no bloquean; cristal y fondo ambiental conservados sobre las manchas de luz, DS-09 y T462): ` +
			`${warned.filter((r) => !r.ok).length} por debajo del mínimo.`
	);
	for (const r of warned) console.log(`  ${line(r).replace(/^NO /, 'AVISO')}`);
}
// Lo que más cambia con el verde salvia: enlaces y botón primario (ver el informe de T454).
const KEY =
	/^(text-interactive(-hover)? \/ surface(-raised|-sunken)?$|color-on-primary \/ (gradient-button-primary|surface-button-primary))/;
console.log('Pares clave (enlaces y botón primario):');
for (const r of results.filter((r) => KEY.test(r.label))) console.log(`  ${line(r)}`);
if (failures.length || notMonotonic.length) process.exit(1);

// ---------------------------------------------------------------- escritura
const INDENT = '\t';
/** @param {Record<string, TokenValue>} tokens @param {string} indent */
const body = (tokens, indent = INDENT) =>
	Object.entries(tokens)
		.map(([name, value]) => `${indent}--${name}: ${cssValue(value)};`)
		.join('\n');
// En el bloque oscuro solo van los tokens cuyo valor cambia: el resto se resuelve desde el claro (var() se evalúa en
// el propio :root, así que un alias del claro toma el valor oscuro de su destino).
const darkOnly = Object.fromEntries(
	Object.entries(THEMES.dark).filter(
		([name, value]) => cssValue(value) !== cssValue(THEMES.light[name] ?? '')
	)
);

const generated = `/* @generated:color:start — NO EDITAR A MANO: lo escribe scripts/generate-tokens.mjs (pnpm tokens) tras verificar el
   contraste WCAG 2.2 AA en ambos temas; pnpm tokens:check falla si esta región no coincide con lo generado.
   Los literales de color solo se admiten dentro de esta región (pnpm lint:tokens). */

/* Primitivas de color (invariantes por tema). */
:root {
${SCALE_ORDER.map((s) => `${INDENT}/* ${SCALE_NOTE[/** @type {keyof typeof SCALE_NOTE} */ (s)]} */\n${STEPS.map((st) => `${INDENT}--${s}-${st}: ${ramps[s]?.[st]};`).join('\n')}`).join('\n\n')}

${Object.entries(EXTRA_PRIMITIVES)
	.map(([name, [hex, note]]) => `${INDENT}--${name}: ${hex}; /* ${note} */`)
	.join('\n')}
${INDENT}--color-white: ${prim['color-white']};
${INDENT}--color-black: ${prim['color-black']};
}

/* Tema CLARO: valor base, sin atributo o con data-theme="light". Los tokens de cristal y fondo ambiental (gradientes,
   superficies translúcidas, --material-saturate, --color-ambient) se conservan tal cual hasta T457 y T458. */
:root {
${INDENT}color-scheme: light dark;
${body(THEMES.light)}
}

:root[data-theme='light'] {
${INDENT}color-scheme: light;
}

/* Tema OSCURO elegido (data-theme="dark")… */
:root[data-theme='dark'] {
${INDENT}color-scheme: dark;
${body(darkOnly)}
}

/* …o por preferencia del sistema cuando no se ha elegido el claro (Sistema funciona sin JavaScript, DS-02). */
@media (prefers-color-scheme: dark) {
${INDENT}:root:not([data-theme='light']) {
${body(darkOnly, INDENT + INDENT)}
${INDENT}}
}

/* Colores de los emails transaccionales. Los clientes de correo no leen variables CSS: la plantilla de email los toma
   de aquí al compilar (\`?raw\`, notifications/emails/layout.ts). Cambiarlos aquí cambia los emails. */
:root {
${Object.entries(EMAIL)
	.map(([name, hex]) => `${INDENT}--${name}: ${hex};`)
	.join('\n')}
}
/* @generated:color:end */`;

const path = join(ROOT, TOKENS);
const current = readFileSync(path, 'utf8');
const REGION = /\/\* @generated:color:start[\s\S]*?@generated:color:end \*\//;
if (!REGION.test(current)) {
	console.error(
		`${TOKENS} no contiene los marcadores @generated:color:start y @generated:color:end`
	);
	process.exit(1);
}
const prettierConfig = (await prettier.resolveConfig(join(REPO_ROOT, TOKENS))) ?? {};
const next = await prettier.format(
	current.replace(REGION, () => generated),
	{
		...prettierConfig,
		filepath: join(REPO_ROOT, TOKENS)
	}
);

if (CHECK) {
	if (next !== current) {
		console.error(
			`${TOKENS} no coincide con lo generado: ejecuta \`pnpm tokens\` (la región generada no se edita a mano).`
		);
		process.exit(1);
	}
	console.log(`${TOKENS} coincide con lo generado.`);
	process.exit(0);
}
writeFileSync(path, next);
console.log(`${TOKENS}: región de color regenerada.`);
