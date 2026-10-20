// Dependencias de `pricing` para las pruebas de integración que leen precios y tipo de cambio sin pasar por el chat: la base y el
// reloj de un `CreditsFixture`, un simulador del BCE y un remitente de email en memoria.
import { createFakeFxSource } from '$lib/server/adapters/ecb/fake';
import { createFakeEmailSender } from '$lib/server/adapters/resend/fake-sender';
import type { PricingDeps } from '$lib/server/features/pricing';
import { createIdGenerator } from '$lib/server/shared/ids';
import type { CreditsFixture } from './credits';
import { seededRandomBytes } from './ids';

export function pricingDepsOf(base: CreditsFixture, seed = 71): PricingDeps {
	const ids = createIdGenerator(seededRandomBytes(seed));
	return {
		db: base.db,
		logger: base.logger,
		clock: base.clock,
		ids,
		apps: { db: base.db, logger: base.logger, clock: base.clock, ids },
		audit: { clock: base.clock, ids, logger: base.logger },
		alerts: {
			db: base.db,
			logger: base.logger,
			clock: base.clock,
			sender: createFakeEmailSender(),
			adminEmail: () => 'admin@mardomingo.test',
			supportEmail: () => 'soporte@mardomingo.com'
		},
		fxSource: createFakeFxSource()
	};
}
