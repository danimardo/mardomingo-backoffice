import adapter from '@sveltejs/adapter-node';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	compilerOptions: {
		runes: true
	},
	kit: {
		adapter: adapter(),
		// Rutas absolutas también al renderizar en el servidor: con `relative: true` (valor por defecto), `resolve()` en un `load`
		// devuelve `./ruta` relativa a la página de esa petición, y los enlaces que viajan en los datos de un layout o de una
		// página quedan rotos al reutilizarlos desde otra profundidad. La aplicación cuelga siempre de la raíz del dominio.
		paths: { relative: false },
		// D-01: la comprobación de origen de SvelteKit rechaza los POST multipart sin
		// cabecera Origin (apps de escritorio). La protección CSRF la hace `handle`,
		// solo en el host web (constitución, principio III).
		csrf: {
			trustedOrigins: ['*']
		},
		csp: {
			mode: 'auto',
			directives: {
				'default-src': ['self'],
				'script-src': ['self'],
				'style-src': ['self'],
				// El anunciador de rutas de SvelteKit (lectores de pantalla) lleva un atributo style fijo. Solo ese valor,
				// por su hash, se permite en atributos style; el resto sigue bloqueado.
				'style-src-attr': ['unsafe-hashes', 'sha256-S8qMpvofolR8Mpjy4kQvEm7m1q8clzU4dfDH0AmvZjo='],
				'img-src': ['self', 'data:'],
				'font-src': ['self'],
				'connect-src': ['self'],
				'object-src': ['none'],
				'base-uri': ['self'],
				'form-action': ['self'],
				'frame-ancestors': ['none']
			}
		}
	}
};

export default config;
