// Publicación de una versión legal desde la administración (W48; BE-FR-70; T314). Publica y, si la versión es informativa, avisa por
// correo a cada cuenta verificada (decisión del propietario). Una versión que exige reaceptación no envía correo: bloquea hasta que
// cada persona la acepte desde su panel.
import type { Composition } from '$lib/server/composition';
import { verifiedUserEmails } from '$lib/server/features/accounts';
import { sendAccountEmail } from '$lib/server/features/notifications';
import { publishVersion, type PublishInput } from '$lib/server/features/legal';

export async function publishAndNotify(
	composition: Composition,
	input: PublishInput
): Promise<{ id: string; notified: number }> {
	const published = publishVersion(composition.legalPublish, input);
	if (input.requiresReacceptance) return { id: published.id, notified: 0 };
	let notified = 0;
	for (const to of verifiedUserEmails(composition.adminUsers)) {
		const sent = await sendAccountEmail(composition.notifications, {
			reason: 'legal_update',
			to,
			idempotencyKey: `legal-${published.id}-${to}`
		});
		if (sent) notified += 1;
	}
	return { id: published.id, notified };
}
