// Subconjunto de Markdown de los documentos legales (T347, D-14): encabezados, párrafos, listas, enlaces y énfasis. Todo el
// HTML de entrada se escapa: el contenido lo escribe un administrador, pero el resultado se sirve sin más a cualquiera.
import { describe, expect, it } from 'vitest';
import { renderMarkdown } from './markdown';

describe('renderMarkdown', () => {
	it('convierte encabezados de nivel 1 a 4 y los párrafos', () => {
		expect(renderMarkdown('# Términos\n\n## 1. Quién\n\n### Sub\n\n#### Más\n\nHola mundo')).toBe(
			'<h1>Términos</h1>\n<h2>1. Quién</h2>\n<h3>Sub</h3>\n<h4>Más</h4>\n<p>Hola mundo</p>'
		);
	});

	it('une las líneas seguidas de un párrafo y separa los párrafos por línea en blanco', () => {
		expect(renderMarkdown('uno\ndos\n\ntres')).toBe('<p>uno dos</p>\n<p>tres</p>');
	});

	it('convierte listas con guion, asterisco y numeradas', () => {
		expect(renderMarkdown('- a\n- b\n\n* c\n\n1. x\n2. y')).toBe(
			'<ul>\n<li>a</li>\n<li>b</li>\n</ul>\n<ul>\n<li>c</li>\n</ul>\n<ol>\n<li>x</li>\n<li>y</li>\n</ol>'
		);
	});

	it('convierte énfasis fuerte, énfasis y código en línea', () => {
		expect(renderMarkdown('Un **fuerte**, un *énfasis*, un _énfasis_ y `código`.')).toBe(
			'<p>Un <strong>fuerte</strong>, un <em>énfasis</em>, un <em>énfasis</em> y <code>código</code>.</p>'
		);
	});

	it('convierte enlaces https, http, mailto y rutas internas', () => {
		expect(
			renderMarkdown(
				'[web](https://mardomingo.com/a?b=1&c=2) [mail](mailto:soporte@mardomingo.com) [uso](/uso-aceptable)'
			)
		).toBe(
			'<p><a href="https://mardomingo.com/a?b=1&amp;c=2">web</a> <a href="mailto:soporte@mardomingo.com">mail</a> <a href="/uso-aceptable">uso</a></p>'
		);
	});

	it('no admite enlaces con otros esquemas: deja el texto sin enlace', () => {
		const html = renderMarkdown(
			'[x](javascript:alert(1)) [y](data:text/html;base64,AA) [z](//evil.example)'
		);
		expect(html).not.toContain('<a');
		expect(html).not.toContain('href');
	});

	it('escapa todo el HTML de entrada, también dentro de encabezados, listas y enlaces', () => {
		const html = renderMarkdown(
			'# <script>alert(1)</script>\n\n<img src=x onerror=alert(1)>\n\n- <b>x</b>\n\n[<i>t</i>](https://a.example/"onmouseover="x)'
		);
		expect(html).not.toMatch(/<(script|img|b|i)[ >]/);
		expect(html).toContain('&lt;script&gt;');
		expect(html).not.toContain('"onmouseover="');
	});

	it('el texto con asteriscos o guiones bajos sueltos no abre énfasis', () => {
		expect(renderMarkdown('2 * 3 = 6 y snake_case_nombre')).toBe(
			'<p>2 * 3 = 6 y snake_case_nombre</p>'
		);
	});

	it('conserva comillas y apóstrofos escapados de forma segura', () => {
		expect(renderMarkdown('Dijo "hola" y \'adiós\'')).toBe(
			'<p>Dijo &quot;hola&quot; y &#39;adiós&#39;</p>'
		);
	});

	it('ignora los saltos de línea de Windows y las líneas en blanco sobrantes', () => {
		expect(renderMarkdown('\r\n# T\r\n\r\n\r\ntexto\r\n')).toBe('<h1>T</h1>\n<p>texto</p>');
	});

	it('un texto vacío da un resultado vacío', () => {
		expect(renderMarkdown('   \n\n')).toBe('');
	});

	it('una cita (>) se trata como párrafo normal: no hay HTML de citas en el subconjunto', () => {
		expect(renderMarkdown('> nota')).toBe('<p>&gt; nota</p>');
	});

	it('una línea con sangría tras un elemento de lista continúa ese elemento; sin sangría abre un párrafo', () => {
		expect(renderMarkdown('- primera\n  continuación\n\n- segunda\nsuelta')).toBe(
			'<ul>\n<li>primera continuación</li>\n</ul>\n<ul>\n<li>segunda</li>\n</ul>\n<p>suelta</p>'
		);
	});

	it('una línea con sangría fuera de una lista se trata como párrafo', () => {
		expect(renderMarkdown('  solo párrafo')).toBe('<p>solo párrafo</p>');
	});

	it('una lista numerada que sigue a una de viñetas abre su propia lista', () => {
		expect(renderMarkdown('- a\n1. b')).toBe('<ul>\n<li>a</li>\n</ul>\n<ol>\n<li>b</li>\n</ol>');
	});

	it('un número junto a un código en línea no se confunde con él', () => {
		expect(renderMarkdown('`a` 5 euros y 30 días')).toBe('<p><code>a</code> 5 euros y 30 días</p>');
	});

	it('el carácter de marcado interno del renderizado se quita de la entrada, sin dejar huecos', () => {
		expect(renderMarkdown('uno 0 dos `c`')).toBe('<p>uno 0 dos <code>c</code></p>');
	});
});
