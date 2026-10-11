// Envío de los formularios de la cuenta con `use:enhance` (UX-01). Mientras una petición está en curso, otro envío del
// mismo formulario se descarta (doble clic, Intro repetido): así no se crean dos cuentas ni se envían dos emails.
// `setBusy` marca el botón con `aria-busy`. Sin JavaScript no hay `enhance` y el envío por POST funciona igual.
import type { SubmitFunction } from '@sveltejs/kit';

/** Envío de un formulario que informa de la espera y descarta los envíos repetidos hasta que llega la respuesta. */
export function singleSubmit(setBusy: (busy: boolean) => void): SubmitFunction {
	let pending = false;
	return ({ cancel }) => {
		if (pending) {
			cancel();
			return;
		}
		pending = true;
		setBusy(true);
		return async ({ update }) => {
			try {
				await update({ reset: false });
			} finally {
				pending = false;
				setBusy(false);
			}
		};
	};
}
