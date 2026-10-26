// Variables de plantilla: esquema, sustitución y comprobación (BE-FR-78 CA1–CA4, BE-FR-79; T162).
import { describe, expect, it } from 'vitest';
import { checkVariables, renderTemplate, type TemplateVariableDef } from './template-variables';

const PNG = 'data:image/png;base64,iVBORw0KGgo=';

const DEFS: readonly TemplateVariableDef[] = [
	{ name: 'texto', type: 'text', required: true, maxChars: 10 },
	{ name: 'nota', type: 'text', required: false },
	{ name: 'foto', type: 'image', required: true, maxMb: 1 }
];

describe('checkVariables', () => {
	it('acepta las variables declaradas, con las opcionales ausentes', () => {
		expect(checkVariables(DEFS, { texto: 'hola', foto: PNG })).toEqual({ ok: true });
	});

	it('[BE-FR-78/CA1] falta una obligatoria → VALIDATION_ERROR con el nombre del campo', () => {
		expect(checkVariables(DEFS, { foto: PNG })).toEqual({ ok: false, field: 'texto' });
	});

	it('sobra una variable no declarada → VALIDATION_ERROR con su nombre', () => {
		expect(checkVariables(DEFS, { texto: 'hola', foto: PNG, extra: 'x' })).toEqual({
			ok: false,
			field: 'extra'
		});
	});

	it('un texto que excede max_chars → VALIDATION_ERROR con su nombre', () => {
		expect(checkVariables(DEFS, { texto: 'x'.repeat(11), foto: PNG })).toEqual({
			ok: false,
			field: 'texto'
		});
	});

	it('una imagen que no es data URL png/jpeg/webp → VALIDATION_ERROR', () => {
		expect(checkVariables(DEFS, { texto: 'hola', foto: 'https://ejemplo.test/a.png' })).toEqual({
			ok: false,
			field: 'foto'
		});
		expect(checkVariables(DEFS, { texto: 'hola', foto: 'data:image/gif;base64,R0lGOD' })).toEqual({
			ok: false,
			field: 'foto'
		});
	});

	it('una imagen mayor que max_mb → VALIDATION_ERROR', () => {
		const big = `data:image/png;base64,${'A'.repeat(Math.ceil((1024 * 1024 * 1.4 * 4) / 3))}`;
		expect(checkVariables(DEFS, { texto: 'hola', foto: big })).toEqual({
			ok: false,
			field: 'foto'
		});
	});
});

describe('renderTemplate', () => {
	it('sustituye {{nombre}} en el texto por el valor de la variable', () => {
		const rendered = renderTemplate(
			[{ role: 'user', content: 'Hola, {{texto}}.' }],
			{ texto: 'Ana', foto: PNG },
			DEFS
		);
		expect(rendered).toEqual([{ role: 'user', content: 'Hola, Ana.' }]);
	});

	it('una parte de imagen se convierte en image_url con la data URL de la variable', () => {
		const rendered = renderTemplate(
			[
				{
					role: 'user',
					content: [
						{ type: 'text', text: 'Mira:' },
						{ type: 'image_url', variable: 'foto' }
					]
				}
			],
			{ texto: 'Ana', foto: PNG },
			DEFS
		);
		expect(rendered).toEqual([
			{
				role: 'user',
				content: [
					{ type: 'text', text: 'Mira:' },
					{ type: 'image_url', image_url: { url: PNG } }
				]
			}
		]);
	});

	it('una variable de texto ausente y opcional se sustituye por cadena vacía', () => {
		const rendered = renderTemplate(
			[{ role: 'user', content: 'Nota: [{{nota}}]' }],
			{ texto: 'x', foto: PNG },
			DEFS
		);
		expect(rendered).toEqual([{ role: 'user', content: 'Nota: []' }]);
	});
});

describe('casos de borde de las variables', () => {
	it('un marcador que nombra una variable no declarada se sustituye por cadena vacía', () => {
		const rendered = renderTemplate([{ role: 'user', content: 'x{{fantasma}}y' }], {}, DEFS);
		expect(rendered).toEqual([{ role: 'user', content: 'xy' }]);
	});

	it('una parte de imagen cuya variable no llega se queda con una URL vacía', () => {
		const rendered = renderTemplate(
			[{ role: 'user', content: [{ type: 'image_url', variable: 'foto' }] }],
			{},
			DEFS
		);
		expect(rendered).toEqual([
			{ role: 'user', content: [{ type: 'image_url', image_url: { url: '' } }] }
		]);
	});

	it('el relleno doble de una imagen cuenta bien para max_mb', () => {
		const padded = `data:image/png;base64,${'A'.repeat(4)}==`;
		expect(checkVariables(DEFS, { texto: 'hola', foto: padded })).toEqual({ ok: true });
		const big = `data:image/png;base64,${'A'.repeat(Math.ceil((1024 * 1024 * 1.4 * 4) / 3))}==`;
		expect(checkVariables(DEFS, { texto: 'hola', foto: big })).toEqual({
			ok: false,
			field: 'foto'
		});
	});
});
