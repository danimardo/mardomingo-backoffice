// Crítico 1 (T112; BE-FR-01, 02, 64 CA2): registro con origen `secretario`, el enlace del email en el _outbox_ de test,
// la verificación por POST desde su botón y la bienvenida con los pasos siguientes. El captcha lo resuelve el simulador de
// Turnstile del global setup; el alta va por la acción del formulario con su Origin, como la haría el navegador.
// Tras verificar, la cookie de sesión es HttpOnly y SameSite=Lax, y el panel no se guarda en caché (T111).
import { expect, test } from './fixtures';
import { PASSWORD, registerAttempt, uniqueEmail, verificationTokenFor } from './outbox';

// Una petición de datos de SvelteKit (`__data.json`) puede quedar abortada al cerrar la página, una vez terminada la
// prueba. No es un fallo de la página: las aserciones verifican el comportamiento. Solo se admite ese caso.
test.use({ guardAllow: [/__data\.json.*ERR_ABORTED/] });

test('@critical registro, verificación y bienvenida con el enlace del email', async ({
	page,
	request,
	baseURL,
	browserName
}) => {
	const email = uniqueEmail('persona');
	const origin = new URL(baseURL ?? 'http://localhost:7390').origin;

	// La acción responde con su resultado: éxito y la dirección a la que se envió (la página no vuelve a mostrar la contraseña).
	const body = await registerAttempt(request, origin, email);
	expect(body).toContain(email);
	expect(body).not.toContain(PASSWORD);

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
	// [BE-FR-64/CA2] Tras verificar, la bienvenida lleva los pasos genéricos. El texto propio de la app de origen llega con
	// `apps.post_verify_text` (L04/L05) y entonces se añade su comprobación.
	// La bienvenida: 1.000 créditos gratuitos (1 €), con su día de caducidad.
	await expect(
		page.getByText(/Te hemos concedido 1000 créditos gratuitos\. Caducan el /)
	).toBeVisible();
	// La página puede tener una carga de datos en vuelo: se espera antes de terminar, para no cortarla al cerrar el test.
	await page.waitForLoadState('networkidle');

	// La cookie de sesión no es legible desde JavaScript y no viaja en peticiones de otros sitios.
	// El atributo Secure depende de la URL base (https en producción; el entorno de pruebas es http) y no se comprueba aquí.
	const cookies = await page.context().cookies();
	const session = cookies.find((cookie) => cookie.name.endsWith('session_token'));
	// Playwright con WebKit informa `sameSite: "None"` para una cookie `Lax`: en WebKit solo se comprueba lo demás.
	expect(session).toMatchObject({
		httpOnly: true,
		path: '/',
		...(browserName === 'webkit' ? {} : { sameSite: 'Lax' })
	});

	// El panel de un usuario verificado no se guarda en caché.
	// Con la petición del contexto, sin navegar: un `goto` aquí aborta la carga de datos de la bienvenida.
	const panel = await page.request.get('/panel', { maxRedirects: 0 });
	expect(panel.headers()['cache-control']).toContain('no-store');
});
