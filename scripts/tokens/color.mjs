// Aritmética de color del generador de tokens (T454; ADR 0009). Adaptado de `scripts/generate-tokens.mjs` del sistema de
// diseño del propietario: luminancia relativa y contraste WCAG 2.2, mezclas sRGB como `color-mix(in srgb)` y escalas
// interpoladas en OKLCH entre anclas. Sin dependencias: lo importan el generador y sus pruebas.

/** Pasos de cada escala de color. */
export const STEPS = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950];

/**
 * @typedef {[number, number, number]} Rgb Canales sRGB entre 0 y 1.
 * @typedef {{ L: number, C: number, H: number }} Oklch
 * @typedef {{ theme: string, label: string, fg: string, bg: string, min: number }} Pair
 * @typedef {Pair & { ratio: number, ok: boolean }} PairResult
 */

/** @param {number} value */
const clamp01 = (value) => Math.min(1, Math.max(0, value));

/**
 * `#RRGGBB` a canales sRGB entre 0 y 1.
 * @param {string} hex
 * @returns {Rgb}
 */
export function hexToRgb(hex) {
	const c = hex.replace('#', '');
	if (!/^[0-9a-fA-F]{6}$/.test(c)) throw new Error(`Color no válido (se espera #RRGGBB): ${hex}`);
	/** @param {number} i */
	const channel = (i) => parseInt(c.slice(i, i + 2), 16) / 255;
	return [channel(0), channel(2), channel(4)];
}

/**
 * @param {Rgb} rgb
 * @returns {string}
 */
export function rgbToHex(rgb) {
	return (
		'#' +
		rgb
			.map((v) =>
				Math.round(clamp01(v) * 255)
					.toString(16)
					.padStart(2, '0')
			)
			.join('')
			.toUpperCase()
	);
}

/** @param {number} v */
const toLinear = (v) => (v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4));
/** @param {number} v */
const fromLinear = (v) => (v <= 0.0031308 ? 12.92 * v : 1.055 * Math.pow(v, 1 / 2.4) - 0.055);

/**
 * Luminancia relativa (WCAG 2.2).
 * @param {string} hex
 */
export function relLuminance(hex) {
	const [r, g, b] = hexToRgb(hex);
	return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
}

/**
 * Relación de contraste WCAG 2.2 entre dos colores opacos.
 * @param {string} a
 * @param {string} b
 */
export function contrast(a, b) {
	const la = relLuminance(a);
	const lb = relLuminance(b);
	return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

/**
 * `color-mix(in srgb, a p, b)`, con `p` entre 0 y 1: lo mismo que calcula el navegador.
 * @param {string} a
 * @param {number} p
 * @param {string} b
 */
export function mix(a, p, b) {
	const [ar, ag, ab] = hexToRgb(a);
	const [br, bg, bb] = hexToRgb(b);
	return rgbToHex([ar * p + br * (1 - p), ag * p + bg * (1 - p), ab * p + bb * (1 - p)]);
}

/**
 * Pinta un color (`#RRGGBB` o `rgba(r, g, b, a)`) sobre un fondo opaco y devuelve el color resultante.
 * @param {string} color
 * @param {string} background
 */
export function composite(color, background) {
	if (color.startsWith('#')) return color.toUpperCase();
	const match = /^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([\d.]+)\s*)?\)$/.exec(
		color.trim()
	);
	if (!match) throw new Error(`Color no válido para componer: ${color}`);
	const hex = rgbToHex([Number(match[1]) / 255, Number(match[2]) / 255, Number(match[3]) / 255]);
	return mix(hex, match[4] === undefined ? 1 : Number(match[4]), background);
}

/**
 * @param {string} hex
 * @returns {Oklch}
 */
export function hexToOklch(hex) {
	const [r, g, b] = hexToRgb(hex).map(toLinear);
	const R = r ?? 0;
	const G = g ?? 0;
	const B = b ?? 0;
	const l = Math.cbrt(0.4122214708 * R + 0.5363325363 * G + 0.0514459929 * B);
	const m = Math.cbrt(0.2119034982 * R + 0.6806995451 * G + 0.1073969566 * B);
	const s = Math.cbrt(0.0883024619 * R + 0.2817188376 * G + 0.6299787005 * B);
	const L = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s;
	const A = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s;
	const Bk = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;
	return { L, C: Math.hypot(A, Bk), H: (Math.atan2(Bk, A) * 180) / Math.PI };
}

/**
 * @param {Oklch} color
 * @returns {string}
 */
export function oklchToHex({ L, C, H }) {
	const A = C * Math.cos((H * Math.PI) / 180);
	const B = C * Math.sin((H * Math.PI) / 180);
	const l = (L + 0.3963377774 * A + 0.2158037573 * B) ** 3;
	const m = (L - 0.1055613458 * A - 0.0638541728 * B) ** 3;
	const s = (L - 0.0894841775 * A - 1.291485548 * B) ** 3;
	return rgbToHex([
		fromLinear(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s),
		fromLinear(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s),
		fromLinear(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s)
	]);
}

/**
 * Escala de once pasos: las anclas se usan TAL CUAL y los pasos que faltan se interpolan en OKLCH entre las anclas
 * vecinas (nunca se «corrige» un ancla). Exige ancla en 50 y en 950.
 * @param {Record<number, string>} anchors
 * @returns {Record<number, string>}
 */
export function buildScale(anchors) {
	const known = Object.keys(anchors)
		.map(Number)
		.sort((a, b) => a - b);
	if (known[0] !== 50 || known[known.length - 1] !== 950) {
		throw new Error('Cada escala necesita ancla en 50 y 950');
	}
	/** @type {Record<number, string>} */
	const out = {};
	for (const step of STEPS) {
		const anchor = anchors[step];
		if (anchor) {
			out[step] = anchor.toUpperCase();
			continue;
		}
		const lo = [...known].reverse().find((k) => k < step) ?? 50;
		const hi = known.find((k) => k > step) ?? 950;
		const t = (STEPS.indexOf(step) - STEPS.indexOf(lo)) / (STEPS.indexOf(hi) - STEPS.indexOf(lo));
		const a = hexToOklch(anchors[lo] ?? '#000000');
		const b = hexToOklch(anchors[hi] ?? '#000000');
		// Matiz: si un extremo es casi acromático, se toma el del otro.
		const ha = a.C < 0.02 ? b.H : a.H;
		const hb = b.C < 0.02 ? a.H : b.H;
		let dH = hb - ha;
		if (dH > 180) dH -= 360;
		if (dH < -180) dH += 360;
		out[step] = oklchToHex({ L: a.L + (b.L - a.L) * t, C: a.C + (b.C - a.C) * t, H: ha + dH * t });
	}
	return out;
}

/**
 * Calcula el contraste de cada par y si llega a su mínimo.
 * @param {Pair[]} pairs
 * @returns {PairResult[]}
 */
export function evaluate(pairs) {
	return pairs.map((pair) => {
		const ratio = contrast(pair.fg, pair.bg);
		return { ...pair, ratio, ok: ratio >= pair.min };
	});
}
