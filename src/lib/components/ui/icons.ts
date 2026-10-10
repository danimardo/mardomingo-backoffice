// Trazos de iconos del sistema de diseño (viewBox 0 0 24 24, trazo `currentColor`). Solo datos: sin markup
// inyectado (`{@html}` está prohibido por el lint). Los trazos vienen de Design/ (icons.ts) y se repiten aquí
// sin cambios; los que no usa la interfaz de cuenta se quedan en Design/.

export interface IconShape {
	readonly d: string;
	/** Punto relleno (p. ej. el de «info»). */
	readonly dot?: true;
}

export interface IconDef {
	readonly shapes: readonly IconShape[];
	readonly strokeWidth: number;
	/** Relleno con `currentColor` en lugar de trazo. */
	readonly filled?: true;
}

const ICON_TABLE = {
	check: {
		strokeWidth: 2.4,
		shapes: [{ d: 'M4 12.5l5 5L20 6.5' }]
	},
	'alert-triangle': {
		strokeWidth: 1.8,
		shapes: [
			{ d: 'M12 4l9.5 16.5H2.5L12 4z' },
			{ d: 'M12 10.2v4.2' },
			{ d: 'M11.1 17.3a0.9 0.9 0 1 0 1.8 0a0.9 0.9 0 1 0 -1.8 0', dot: true }
		]
	},
	'x-circle': {
		strokeWidth: 1.8,
		shapes: [{ d: 'M3.5 12a8.5 8.5 0 1 0 17 0a8.5 8.5 0 1 0 -17 0' }, { d: 'M9 9l6 6M15 9l-6 6' }]
	},
	info: {
		strokeWidth: 1.8,
		shapes: [
			{ d: 'M3.7 12a8.3 8.3 0 1 0 16.6 0a8.3 8.3 0 1 0 -16.6 0' },
			{ d: 'M12 11v5.3' },
			{ d: 'M11.1 8.2a0.9 0.9 0 1 0 1.8 0a0.9 0.9 0 1 0 -1.8 0', dot: true }
		]
	},
	close: {
		strokeWidth: 1.9,
		shapes: [{ d: 'M6 6l12 12M18 6L6 18' }]
	},
	search: {
		strokeWidth: 1.9,
		shapes: [
			{ d: 'M4.5 10.8a6.3 6.3 0 1 0 12.6 0a6.3 6.3 0 1 0 -12.6 0' },
			{ d: 'M19.5 19.5l-4.3-4.3' }
		]
	},
	'chevron-down': {
		strokeWidth: 2,
		shapes: [{ d: 'M5.5 8.5l6.5 7 6.5-7' }]
	},
	'external-link': {
		strokeWidth: 1.8,
		shapes: [
			{ d: 'M9.5 5.5h-4a1 1 0 00-1 1v12a1 1 0 001 1h12a1 1 0 001-1v-4' },
			{ d: 'M13 4.5h6.5V11' },
			{ d: 'M19 5l-9 9' }
		]
	},
	'arrow-right': {
		strokeWidth: 2,
		shapes: [{ d: 'M4.5 12h14.5' }, { d: 'M13.5 6.5L19.5 12l-6 5.5' }]
	},
	shield: {
		strokeWidth: 1.8,
		shapes: [
			{ d: 'M12 3.2l7 2.6v5.4c0 4.5-3 7.6-7 9.6-4-2-7-5.1-7-9.6V5.8l7-2.6z' },
			{ d: 'M9 12l2.2 2.2L15.5 9.5' }
		]
	},
	settings: {
		strokeWidth: 1.7,
		shapes: [
			{ d: 'M12 15.2a3.2 3.2 0 100-6.4 3.2 3.2 0 000 6.4z' },
			{
				d: 'M19.4 15a1.7 1.7 0 00.34 1.87l.06.06a2.06 2.06 0 11-2.9 2.9l-.07-.06a1.7 1.7 0 00-1.87-.34 1.7 1.7 0 00-1.03 1.56V21.4a2.06 2.06 0 11-4.12 0v-.1a1.7 1.7 0 00-1.03-1.56 1.7 1.7 0 00-1.87.34l-.07.06a2.06 2.06 0 11-2.9-2.9l.06-.06A1.7 1.7 0 004.6 15a1.7 1.7 0 00-1.56-1.03H2.94a2.06 2.06 0 110-4.12h.1A1.7 1.7 0 004.6 8.82a1.7 1.7 0 00-.34-1.87l-.06-.07a2.06 2.06 0 112.9-2.9l.07.06A1.7 1.7 0 008.94 4.4h.09A1.7 1.7 0 0010.56 3V2.94a2.06 2.06 0 114.12 0v.1A1.7 1.7 0 0016 4.4a1.7 1.7 0 001.87-.34l.07-.06a2.06 2.06 0 112.9 2.9l-.06.07a1.7 1.7 0 00-.34 1.87v.09c.24.68.82 1.18 1.56 1.24h.1a2.06 2.06 0 110 4.12h-.1A1.7 1.7 0 0019.4 15z'
			}
		]
	},
	home: {
		strokeWidth: 1.9,
		shapes: [
			{ d: 'M4 11.5L12 4l8 7.5' },
			{ d: 'M6 10v9.2a.8.8 0 00.8.8H10v-6h4v6h3.2a.8.8 0 00.8-.8V10' }
		]
	},
	clock: {
		strokeWidth: 1.8,
		shapes: [{ d: 'M3.7 12a8.3 8.3 0 1 0 16.6 0a8.3 8.3 0 1 0 -16.6 0' }, { d: 'M12 7.5V12l3.3 2' }]
	},
	refresh: {
		strokeWidth: 1.9,
		shapes: [
			{ d: 'M4.5 12a7.5 7.5 0 0112.9-5.2M19.5 12a7.5 7.5 0 01-12.9 5.2' },
			{ d: 'M17 4.5v3.5h-3.5M7 19.5V16h3.5' }
		]
	},
	copy: {
		strokeWidth: 1.7,
		shapes: [{ d: 'M15 8.5V6a1.5 1.5 0 00-1.5-1.5H6A1.5 1.5 0 004.5 6v7.5A1.5 1.5 0 006 15h2.5' }]
	},
	edit: {
		strokeWidth: 1.8,
		shapes: [
			{ d: 'M4 20l.9-3.9L16.6 4.4a1.5 1.5 0 012.1 0l1 1a1.5 1.5 0 010 2.1L8 19.2 4 20z' },
			{ d: 'M14.5 6.5l3 3' }
		]
	},
	trash: {
		strokeWidth: 1.8,
		shapes: [
			{ d: 'M4.5 7h15' },
			{ d: 'M9 7V5a1 1 0 011-1h4a1 1 0 011 1v2' },
			{ d: 'M6.5 7l.7 12.1a1.5 1.5 0 001.5 1.4h6.6a1.5 1.5 0 001.5-1.4L17.5 7' },
			{ d: 'M10 11v6M14 11v6' }
		]
	},
	filter: {
		strokeWidth: 1.8,
		shapes: [{ d: 'M4 5.5h16l-6 7v6l-4 2v-8l-6-7z' }]
	}
} as const satisfies Record<string, IconDef>;

export type IconName = keyof typeof ICON_TABLE;

export const ICONS: Readonly<Record<IconName, IconDef>> = ICON_TABLE;
