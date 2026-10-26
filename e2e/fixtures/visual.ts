// Datos fijos para las capturas de regresión visual de la landing y del login (T355; 15.18, 16.11). Las capturas de referencia
// (T-VIS-001) se generan en el contenedor oficial de Playwright, no en Windows, y llegan en L16. Aquí solo están los datos que
// hacen repetible una captura: fecha de reloj, tamaños de ventana y el nombre de la app de ejemplo.
export const VISUAL_CLOCK_ISO = '2026-10-20T10:00:00Z';
export const VISUAL_VIEWPORTS = [
	{ name: 'movil', width: 390, height: 844 },
	{ name: 'escritorio', width: 1366, height: 800 }
] as const;
export const VISUAL_APP_NAME = 'Secretario AI';
