// Versiones provisionales de los documentos legales (BE-FR-70, BE-FR-26; T093, T092). Su texto NO es el definitivo y no tiene
// valor legal: son borradores con huecos marcados entre corchetes, para que el propietario los revise y apruebe. Se siembran
// con `created_by` nulo (versión del sistema, O1) y de forma idempotente; las instalaciones que ya tienen la versión
// provisional la conservan hasta que se publique otra versión desde el administrador.
import { createHash } from 'node:crypto';
import type { Tx } from '$lib/server/db/tx';
import type { EpochMs } from '$lib/shared/time';
import { insertDocument } from './repository';
import { LEGAL_DOCUMENTS } from './schema';

type LegalDocument = (typeof LEGAL_DOCUMENTS)[number];

/** Versión provisional de la primera publicación del sistema. */
export const PROVISIONAL_VERSION = '2026-10-11';

const BANNER =
	'BORRADOR PROVISIONAL, SIN VALOR LEGAL. Pendiente de la revisión y aprobación del propietario (T092). Los datos entre corchetes son huecos por completar.';

export const PROVISIONAL_TEXTS: Readonly<Record<LegalDocument, string>> = Object.freeze({
	terms: [
		BANNER,
		'Condiciones de uso de Cuenta Mardomingo',
		'1. Objeto. Estas condiciones regulan el uso de la cuenta, del panel y de las apps conectadas, como Secretario AI.',
		'2. Créditos. El uso de las apps consume créditos. Su precio, su caducidad y su reembolso se rigen por [pendiente: política de créditos].',
		'3. Responsabilidad. [pendiente: cláusulas de responsabilidad].',
		'4. Ley aplicable y jurisdicción. [pendiente: ley aplicable y tribunales competentes].'
	].join('\n\n'),
	privacy: [
		BANNER,
		'Política de privacidad de Cuenta Mardomingo',
		'1. Responsable del tratamiento. [pendiente: identidad y datos de contacto del responsable].',
		'2. Datos que tratamos. Datos de la cuenta, de la sesión y del uso de las apps. [pendiente: categorías completas].',
		'3. Finalidades y base jurídica. [pendiente: finalidades y base jurídica de cada tratamiento].',
		'4. Conservación. [pendiente: plazos de conservación por categoría de dato].',
		'5. Derechos. Puedes acceder, rectificar, suprimir y limitar tus datos desde el panel. [pendiente: procedimiento completo].',
		'6. Apps y proveedores. Las apps que tratan tus datos son Secretario AI. Los proveedores que los procesan son OpenRouter (modelos de IA), Mistral (transcripción de audio), Resend (envío de emails) y Cloudflare Turnstile (verificación anti-bots en el registro). [pendiente: finalidad y datos por cada proveedor].'
	].join('\n\n'),
	cookies: [
		BANNER,
		'Política de cookies',
		'Cuenta Mardomingo usa cookies técnicas necesarias para la sesión y las preferencias de tema y de efectos. [pendiente: inventario completo y si hay cookies no técnicas].'
	].join('\n\n'),
	aup: [
		BANNER,
		'Uso aceptable',
		'No se permite usar las apps para actividades ilícitas, para dañar a terceros ni para eludir los límites de uso. [pendiente: lista completa de usos prohibidos y consecuencias].'
	].join('\n\n'),
	withdrawal_waiver: [
		BANNER,
		'Renuncia al derecho de desistimiento',
		'Al comprar créditos digitales que se usan de inmediato, aceptas renunciar al derecho de desistimiento en los términos que apruebe el propietario. [pendiente: texto legal definitivo de la renuncia].'
	].join('\n\n')
});

export function seedLegalDocuments(tx: Tx, ids: () => string, now: EpochMs): void {
	for (const document of LEGAL_DOCUMENTS) {
		const content = PROVISIONAL_TEXTS[document];
		insertDocument(
			tx,
			{
				id: ids(),
				document,
				version: PROVISIONAL_VERSION,
				content,
				contentHash: createHash('sha256').update(content, 'utf8').digest('hex'),
				// Exige aceptación: quien no haya aceptado la primera versión queda bloqueado hasta aceptarla (BE-FR-70 CA1).
				requiresReacceptance: true,
				publishedAt: now,
				createdBy: null,
				createdAt: now
			},
			{ ignoreExisting: true }
		);
	}
}
