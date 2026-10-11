// Crítico 1 (T112; BE-FR-01, 02, 64 CA2): registro con origen `secretario`, el enlace del email en el _outbox_ de test,
// la verificación por POST desde su botón y la bienvenida con los pasos siguientes. El captcha lo resuelve el simulador de
// Turnstile del global setup; el alta va por la acción del formulario con su Origin, como la haría el navegador.
// Tras verificar, la cookie de sesión es HttpOnly y SameSite=Lax, y el panel no se guarda en caché (T111).
import { expect, test } from './fixtures';
import { PASSWORD, uniqueEmail, verificationTokenFor } from './outbox';

const PROVISIONAL_LEGAL_VERSION = '2026-10-11';

test('@critical registro, verificación y bienvenida con el enlace del email', async ({
	page,
	request,
	baseURL
}) => {
	const email = uniqueEmail('persona');
	const origin = new URL(baseURL ?? 'http://localhost:7390').origin;

	const registration = await request.post('/registro?/registrar', {
		headers: { origin },
		form: {
			email,
			password: PASSWORD,
			acceptTerms: 'on',
			acceptPrivacy: 'on',
			acceptAup: 'on',
			ageDeclaration: 'on',
			'cf-turnstile-response': 'token-del-simulador',
			app: 'secretario',
			versionTerms: PROVISIONAL_LEGAL_VERSION,
			versionPrivacy: PROVISIONAL_LEGAL_VERSION,
			versionAup: PROVISIONAL_LEGAL_VERSION
		}
	});
	expect(registration.status()).toBe(200);
	// La acción responde con su resultado: éxito y la dirección a la que se envió (la página no vuelve a mostrar la contraseña).
	expect(await registration.text()).toContain(email);
	expect(await registration.text()).not.toContain(PASSWORD);

	await page.goto(`/verificar?token=${encodeURIComponent(verificationTokenFor(email))}`);
	await page.getByRole('button', { name: 'Confirmar mi email' }).click();
	// El ratón se queda sobre el botón; tras la navegación, la precarga por hover de SvelteKit pediría datos de lo que quede
	// debajo, y esa petición se cortaría al cerrar el test. Se aparta el ratón.
	await page.mouse.move(0, 0);

	await expect(page).toHaveURL(/\/panel\/bienvenida$/);
	await expect(page.getByRole('heading', { name: 'Bienvenido' })).toBeVisible();
	await expect(
		page.getByText('Inicia sesión con tu email en la app que quieras usar.')
	).toBeVisible();
	// La página puede tener una carga de datos en vuelo: se espera antes de terminar, para no cortarla al cerrar el test.
	await page.waitForLoadState('networkidle');

	// La cookie de sesión no es legible desde JavaScript y no viaja en peticiones de otros sitios.
	// El atributo Secure depende de la URL base (https en producción; el entorno de pruebas es http) y no se comprueba aquí.
	const cookies = await page.context().cookies();
	const session = cookies.find((cookie) => cookie.name.endsWith('session_token'));
	expect(session).toMatchObject({ httpOnly: true, sameSite: 'Lax', path: '/' });

	// El panel de un usuario verificado no se guarda en caché.
	// Con la petición del contexto, sin navegar: un `goto` aquí aborta la carga de datos de la bienvenida.
	const panel = await page.request.get('/panel', { maxRedirects: 0 });
	expect(panel.headers()['cache-control']).toContain('no-store');
});
