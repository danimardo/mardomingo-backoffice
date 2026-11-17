# Correcciones pendientes de `001-cuenta-mardomingo-v4`

Revisión de la implementación frente a `Historias.md`, `data-model.md`, `plan.md` y `tasks.md`, iniciada el 2026-11-12.
Este fichero es la **guía de implementación** de las tareas T393 en adelante de `tasks.md` (fase 17). Cada hallazgo es
autocontenido: se puede corregir sin leer los demás.

## Cómo usar este fichero (instrucciones para quien implementa)

1. Trabaja **un hallazgo cada vez**, en el orden de gravedad (Alta → Media → Baja) salvo que una tarea diga otra cosa.
2. En cada hallazgo: escribe **primero el test** indicado y comprueba que **falla** por el motivo descrito; después aplica el
   cambio y comprueba que pasa. Si el test no falla antes del cambio, detente y anótalo en el hallazgo: puede que ya esté
   corregido o que el diagnóstico no sea exacto.
3. No cambies nada fuera de los ficheros que nombra el hallazgo. Si hace falta tocar otra funcionalidad o romper una frontera
   de `ARCHITECTURE.md`, detente y anótalo.
4. Verificación por hallazgo: `pnpm test:related <ficheros tocados>` y `pnpm lint:changed`. Al cerrar el grupo:
   `pnpm verify:batch`. No lances la suite completa tras cada edición.
5. No rebajes umbrales, no borres aserciones y no marques la tarea `[x]` sin haber ejecutado su verificación.
6. Sin commits ni push sin autorización del propietario. Mensajes y documentación en español; identificadores en inglés.
7. Si un hallazgo dice «decisión del propietario», no lo implementes: déjalo abierto.

**Estado de verificación** de cada hallazgo: «confirmado por ejecución» (se reprodujo con un test o un script),
«confirmado por lectura» (el código lo muestra sin ambigüedad, sin haberlo ejecutado) o «sospecha» (hay que reproducirlo antes
de corregir).

## Índice

| Id   | Gravedad | Área     | Resumen                                                                                  | Tarea |
| ---- | -------- | -------- | ---------------------------------------------------------------------------------------- | ----- |
| C-01 | Alta     | payments | El contracargo de una compra `partially_refunded` se descarta                            | T393  |
| C-02 | Media    | credits  | Una reserva caducada sigue restando saldo disponible hasta la tarea diaria               | T394  |
| C-03 | Media    | payments | El informe contable cuenta dos veces lo ya devuelto cuando hay contracargo               | T395  |
| C-04 | Baja     | payments | Si la rectificativa falla tras confirmar el reembolso, no se reintenta nunca             | T396  |
| C-05 | Media    | apps     | `personal: true` no llega a las bases ya sembradas: en staging y producción no hay aviso | T397  |
| C-06 | Media    | sync     | Ningún test comprueba que el aviso se pinta; el test «no preselecciona» prueba otra cosa | T398  |
| C-07 | Baja     | apps     | Volver a la versión anterior con `personal` en la BD deja ilegible la app                | T399  |
| C-08 | Baja     | web      | El aviso no está asociado al grupo de casillas ni nombra la categoría                    | T400  |
| C-09 | Baja     | docs     | `data-model.md` y `contracts/web-routes.md` no recogen `personal`                        | T401  |
| C-10 | Media    | payments | Se puede reembolsar una compra real en `chargeback` o en `pending`                       | T402  |
| C-11 | Media    | docs     | data-model 4.5 decía que el contracargo en `refunded` no mueve créditos                  | T403  |
| C-12 | Baja     | payments | El reintento de C-04 no se puede hacer desde W37 y el aviso no identifica la compra      | T404  |
| C-13 | Baja     | payments | El reenvío con la misma clave y otro importe emite la rectificativa con ese importe      | T405  |
| C-14 | Baja     | credits  | Con C-02, una operación más larga que `hold_ttl_seconds` deja de estar reservada         | T406  |
| C-15 | Media    | accounts | Los tokens pendientes sobreviven a los cambios de credenciales                           | T407  |
| C-16 | Media    | accounts | Carrera en el bloqueo de login por fallos                                                | T410  |
| C-17 | Media    | accounts | El tiempo de respuesta revela si una cuenta existe                                       | T413  |
| C-18 | Media    | accounts | No se envía el aviso de seguridad al cambiar la contraseña                               | T408  |
| C-19 | Baja     | web      | La confirmación del cambio de email no sigue W14                                         | T414  |
| C-20 | Baja     | accounts | Usar un enlace de recuperación no anula los anteriores                                   | T409  |
| C-21 | Baja     | accounts | Carrera en el límite de registros por IP                                                 | T411  |
| C-22 | Baja     | accounts | El administrador puede bloquearse a sí mismo                                             | T415  |
| C-23 | Baja     | accounts | No se puede cambiar el email a la propia forma normalizada                               | T416  |
| C-24 | Baja     | accounts | Sin límite de intentos en el cambio de contraseña ni en la eliminación de cuenta         | T412  |
| C-25 | Baja     | adapters | Turnstile no valida `hostname` ni `action`                                               | T417  |

C-05 a C-09 proceden de la revisión del PR #47 (D14, 2026-11-17), hecha con Opus por lectura, sin ejecutar nada. C-05 se ha
comprobado además a mano (el seed solo inserta si no existe y no hay migración posterior a la 0016); el resto no se ha
reverificado.

---

## C-01 (Alta) — El contracargo de una compra parcialmente reembolsada se descarta

- **Requisito**: BE-FR-28; `data-model.md` 4.5 (`completed / partially_refunded` + `chargeback_opened` → `chargeback`).
- **Fichero**: `src/lib/server/features/payments/service.ts`, función `applyEvent` (rama `chargeback_opened`).
- **Estado**: corregido (T393, 2026-11-17). Reproducido con test (el estado seguía en `partially_refunded` y el evento se rechazaba) y verificado con `test:related` y `lint:changed`.
- **Qué pasa**: la condición `row.status !== 'completed' && row.status !== 'refunded'` rechaza el evento
  (`payments.webhook.rejected`, `not_completed`) cuando la compra está en `partially_refunded`. Resultado: no se retira el
  saldo restante, no hay deuda, no se bloquea la cuenta y no hay rectificativa. Además acepta `refunded`, que la tabla de
  transiciones no contempla (es inocuo: el objetivo sale 0, pero bloquea la cuenta).
- **Cambio**: aceptar `completed` y `partially_refunded`. Para `refunded`, **decidido por el propietario (2026-11-17)**: se
  acepta y bloquea la cuenta; pasa a `chargeback` retirando lo que quede de la compra (0 si los reembolsos retiraron todo; ver
  C-11) y sin rectificativa (importe pendiente 0). Enmendar `data-model.md` 4.5 para añadir `refunded` + `chargeback_opened` →
  `chargeback`, y cubrirlo con un segundo caso en el mismo test.

  ```ts
  const chargeable =
  	row.status === 'completed' || row.status === 'partially_refunded' || row.status === 'refunded';
  if (!chargeable) {
  	/* rechazo actual */
  }
  ```

- **Test (primero, debe fallar)**: en `src/lib/server/features/payments/refund-chargeback.int.test.ts`, con una compra **real**
  (proveedor falso no simulado, como en los tests de reembolso con importe del mismo fichero): reembolso parcial de 500
  céntimos retirando parte de los créditos; después `chargeback_opened`. Esperado: `status = 'chargeback'`; movimiento
  `chargeback` por (créditos de la compra − créditos ya retirados por `refund`), repartido entre bolsa y deuda; cuenta
  bloqueada; evento `payments.chargeback.applied`; rectificativa por (pagado − ya devuelto) si el proveedor de facturación
  falso emite.
- **Verificación**: `pnpm test:related src/lib/server/features/payments/service.ts`.

## C-02 (Media) — Una reserva caducada sigue contando como saldo reservado hasta las 04:40

- **Requisito**: BE-FR-71 («Las reservas caducan a los `hold_ttl_seconds`»), `Historias.md` línea 1026 («la reserva se libera
  por caducidad o al reiniciar»).
- **Ficheros**: `src/lib/server/features/credits/repository.ts` (`reservedOf`, `openHolds`, `freeAccountsOpenHoldsMicro`),
  `src/lib/server/jobs/schedule.ts` (`holds-cleanup`, `40 4 * * *`).
- **Estado**: corregido (T394, 2026-11-17). Reproducido con test (reservado 300 en vez de 0 tras caducar) y verificado con `test:related` y `lint:changed`.
- **Qué pasa**: `reservedOf` suma todas las reservas con `released_at IS NULL`, sin mirar `expires_at`. Las caducadas solo se
  cierran en `expireHolds`, que se ejecuta una vez al día. Una reserva que quede abierta sin reinicio (un camino que no la
  libere) bloquea ese saldo hasta 24 h, no 10 minutos, y también cuenta para el tope diario y para el freno global.
- **Cambio** (el mínimo, sin tocar el horario): que las lecturas de «reservado» ignoren las reservas ya caducadas.
  - `reservedOf(db, userId, now)`: sumar solo `expires_at > now`. Actualizar todas sus llamadas en `credits/service.ts`
    (`reserve`, `adjust`, `getBalance`, `adjustableByKind`) pasando `deps.clock.now()`.
  - `freeAccountsOpenHoldsMicro(db, now)`: igual; actualizar su llamada (búscala con Grep, está fuera de `repository.ts`).
  - **No** cambies `openHoldOf` ni `chargeAndRelease`: una operación que termina con su reserva caducada pero aún no cerrada
    debe poder cobrarse.
- **Test (primero, debe fallar)**: en `src/lib/server/features/credits/credits.int.test.ts`: crear una reserva, avanzar el
  reloj falso `hold_ttl_seconds + 1` segundos **sin** llamar a `expireHolds`; `getBalance().reservedMicro` debe ser 0 y una
  nueva `reserve` por todo el disponible debe aceptarse. Segundo caso: `chargeAndRelease` de la reserva caducada y no cerrada
  sigue cobrando (`ok: true`).
- **Verificación**: `pnpm test:related src/lib/server/features/credits/repository.ts src/lib/server/features/credits/service.ts`.

## C-03 (Media) — El informe contable duplica lo devuelto cuando hay contracargo

- **Requisito**: BE-FR-76; `data-model.md` 4.5 (la rectificativa del contracargo es por lo pagado menos lo ya devuelto).
- **Fichero**: `src/lib/server/features/payments/service.ts`, `paymentFactsBetween`.
- **Estado**: corregido (T395, 2026-11-17). Reproducido con test (1000 en vez de 600) y verificado con `test:related` y `lint:changed`.
- **Qué pasa**: `chargebackEurCents: row.status === 'chargeback' ? row.amountEurCents : 0`. Si la compra tenía un reembolso
  parcial previo, la fila informa `refundedEurCents` y además el total como contracargo: devuelto + contracargo > total. El
  propio `applyChargeback` usa `amountEurCents - refundedEurCents` para la rectificativa, así que los dos números no cuadran.
- **Cambio**: `chargebackEurCents: row.status === 'chargeback' ? row.amountEurCents - row.refundedEurCents : 0`.
- **Test (primero, debe fallar)**: en `src/lib/server/features/payments/payment-facts.int.test.ts`: compra de 1000 céntimos con
  `refunded_eur_cents = 400` y `status = 'chargeback'` → `chargebackEurCents` 600 y `refundedEurCents` 400. Depende de C-01
  solo si el test llega a ese estado por eventos; puede prepararse la fila directamente.
- **Verificación**: `pnpm test:related src/lib/server/features/payments/service.ts`.

## C-04 (Baja) — La rectificativa de un reembolso no se reintenta si falla

- **Requisito**: BE-FR-27 («se emite la factura rectificativa»).
- **Fichero**: `src/lib/server/features/payments/service.ts`, `refund` (llamada a `deps.invoicing.correctPayment` tras la
  transacción).
- **Estado**: corregido (T396, 2026-11-17). Reproducido con test (la excepción se propagaba y no quedaba rastro) y verificado con `test:related` y `lint:changed`. Límite: el reenvío solo reintenta si su clave es el último reembolso aplicado de la compra; tras otro reembolso, la rectificativa pendiente del anterior queda en `payments.refund.corrective_pending` para tratarla a mano (reconstruir su `issueKey` exigiría guardar el total en `refund_keys`, con migración).
- **Qué pasa**: la rectificativa se emite después de confirmar el reembolso y marcar la clave como aplicada. Si
  `correctPayment` lanza o devuelve `skipped: not_issued`, el reembolso queda sin rectificativa y un reenvío con la misma clave
  responde «repetido» sin volver a intentarlo. No queda ningún rastro que permita detectarlo.
- **Cambio**: no cambies el orden. (1) En el camino «repetido» (`repeatedRefund`), vuelve a llamar a `correctPayment` con la
  misma `issueKey` (`refund:<paymentId>:<refundedEurCents de la fila>`): es idempotente por `issue_key`. (2) Si el resultado de
  `correctPayment` no es `issued`, `duplicate` ni `skipped` con motivo `simulated` o `provider_none`, emite un evento
  `payments.refund.corrective_pending` (añádelo al catálogo de `payments/events.ts` y a `contracts/log-events.md`), sin
  importes ni ids de usuario.
- **Test (primero, debe fallar)**: en `refund-chargeback.int.test.ts`, con el proveedor de facturación falso configurado para
  fallar una vez: el reembolso se aplica, se registra `payments.refund.corrective_pending`, y el reenvío con la misma clave
  emite la rectificativa (una sola factura `corrective`).
- **Verificación**: `pnpm test:related src/lib/server/features/payments/service.ts`.

---

## C-05 (Media) — `personal: true` solo llega a bases nuevas; en staging y producción no hay aviso

- **Requisito**: D14 (= R14), BE-FR-42 CA3, US6 escenario 5 (`spec.md:147`).
- **Ficheros**: `src/lib/server/features/apps/seed.ts` (inserta solo si no existe), `src/lib/server/features/apps/defaults.ts:99`
  (`prompts: { strategy: 'block', personal: true }`), `drizzle/` (la última migración es `0016_refund_keys_reembolso.sql`).
- **Estado**: confirmado por lectura (revisión del PR #47 y comprobación manual del seed y de `drizzle/`).
- **Qué pasa**: en staging y producción la fila `apps.sync_schema` de `secretario` conserva `prompts: { strategy: 'block' }`. W43
  no muestra el aviso. En tests y E2E la base es nueva y sí sale, así que el CI en verde no lo detecta. El propio PR lo anota en
  `tasks.md` (T312) como paso manual, pero no está en `docs/operaciones/`.
- **Cambio**: migración de datos personalizada (`drizzle-kit generate --custom`), como `0006_image_cap_200_creditos.sql` y
  `0014_legal_reaceptacion_inicial.sql`, que solo toque la fila sembrada sin pisar un esquema cambiado por el administrador:

  ```sql
  -- D14 (= R14): `prompts` de Secretario es una categoría personal. El seed solo inserta si no existe.
  UPDATE apps
  SET sync_schema = json_set(sync_schema, '$.categories.prompts.personal', json('true')),
      updated_at = CAST(strftime('%s', 'now') AS INTEGER) * 1000
  WHERE slug = 'secretario'
    AND json_extract(sync_schema, '$.categories.prompts.strategy') = 'block'
    AND json_extract(sync_schema, '$.categories.prompts.personal') IS NULL;
  ```

  Comprueba antes la unidad de `updated_at` en el esquema de `apps`. Actualizarlo invalida la caché de `sync`
  (`syncSchemaStampOf`). Se despliega **después** del PR #47 (C-07).

- **Test (primero, debe fallar)**: en `src/lib/server/db/migrations.int.test.ts`, aplicar las migraciones hasta la 0016, insertar
  `secretario` con el esquema anterior (sin `personal`), aplicar las restantes y comprobar que
  `categories.prompts.personal === true`. Segundo caso: si el administrador cambió `prompts` a `items`, la fila no se toca.
- **Verificación**: `pnpm test:related src/lib/server/db/migrations.int.test.ts`; probar la migración en staging antes de
  producción (constitución).

## C-06 (Media) — Ningún test comprueba el aviso; el test «no preselecciona» prueba otra cosa

- **Requisito**: D14 («la vista previa la avisa y no preselecciona nada»), BE-FR-42 CA3.
- **Ficheros**: `src/lib/server/features/sync/domain/copy-defaults.test.ts:54-58`,
  `src/routes/(web)/admin/apps/[slug=appSlug]/predeterminados/copiar/+page.svelte:42-44`,
  `tests/http/admin-predeterminados.test.ts`, `e2e/admin-contenido.spec.ts:693-707`.
- **Estado**: confirmado por lectura (revisión del PR #47); no reverificado.
- **Qué pasa**: el test unitario titulado «no preselecciona nada» solo comprueba `applyCopy(SCHEMA, SOURCE, [])` → `{}`, que ya
  estaba cubierto. Ningún test HTTP, de componente ni E2E comprueba que el `Banner` aparece en `prompts` y no en las demás
  categorías: quitar el `{#if category.personal}` deja todo en verde. La no preselección sí la cubre el E2E de
  `admin-contenido.spec.ts:693-702`.
- **Cambio**: renombrar o quitar el test unitario. Añadir un caso en `admin-predeterminados.test.ts` con un documento del
  administrador que tenga `prompts` y `preferences`: `?vista=propia` contiene el texto de `admin_defaults_personal_warning` una
  sola vez.
- **Test (primero, debe fallar)**: el caso HTTP, comprobando que falla con el `{#if category.personal}` quitado temporalmente.
- **Verificación**: `pnpm test:http` (el fichero).

## C-07 (Baja) — Volver a la versión anterior con `personal` en la BD deja ilegible la app

- **Requisito**: constitución, migraciones (compatibilidad y despliegue intermedio), por analogía.
- **Ficheros**: `src/lib/server/features/apps/repository.ts:106-120` (`validatedApp` → `checked(SyncSchema, …)`),
  `src/lib/server/features/apps/json-schemas.ts:65-82`.
- **Estado**: confirmado por lectura que la versión anterior (`z.strictObject` sin `personal`) rechaza la clave; el alcance exacto
  de la caída es una sospecha.
- **Qué pasa**: con `personal: true` en la BD y la imagen anterior, `readApp`, `readAppBySlug` y `listAppOverrides` lanzarían
  error de corrupción para esa fila; `resolveAppBySlug` fallaría en las peticiones con `X-App-Id: secretario`.
- **Cambio**: sin cambio de código. Desplegar primero el PR #47 y, en un despliegue posterior, T397. Documentar en
  `docs/operaciones/` que volver a una imagen anterior exige quitar antes la clave.
- **Verificación**: manual en staging, si se quiere: imagen anterior con `personal` en la BD, `GET /api/v1/health` y una petición
  con `X-App-Id: secretario`.

## C-08 (Baja) — El aviso no está asociado al grupo de casillas ni nombra la categoría

- **Requisito**: D14 y `Historias.md` 16.10 (mensajes enlazados al control).
- **Ficheros**: `src/routes/(web)/admin/apps/[slug=appSlug]/predeterminados/copiar/+page.svelte:42-50`,
  `src/lib/components/ui/CheckboxGroup.svelte` (no admite descripción, solo `error`).
- **Estado**: confirmado por lectura; el efecto en un lector de pantalla no se ha verificado.
- **Qué pasa**: el `Banner` queda fuera del `fieldset` y sin `aria-describedby`; al recorrer el formulario por controles no se
  oye el aviso. El texto no dice qué categoría es.
- **Cambio**: el sistema de diseño solo cambia con aprobación. Vía (a): prop opcional `description` en `CheckboxGroup` que pinte
  un `<p id="{id}-desc">` dentro del `fieldset`, enlazado con `aria-describedby` (**decisión del propietario**). Vía (b), sin
  tocar el sistema de diseño: incluir la marca en la `legend` y parametrizar el mensaje con `{category}`.
- **Test (primero, debe fallar)**: E2E en `admin-contenido.spec.ts`:
  `expect(page.getByRole('group', { name: /prompts/ })).toHaveAccessibleDescription(/datos personales/)` (vía a) o el nombre
  accesible del grupo (vía b).
- **Verificación**: `pnpm test:e2e:a11y`.

## C-09 (Baja) — `data-model.md` y `contracts/web-routes.md` no recogen `personal`

- **Requisito**: CLAUDE.md (una contradicción se resuelve enmendando un documento).
- **Ficheros**: `specs/001-cuenta-mardomingo-v4/data-model.md:919`, `specs/001-cuenta-mardomingo-v4/contracts/web-routes.md:617-618`.
- **Estado**: confirmado por lectura (revisión del PR #47); no reverificado.
- **Cambio**: añadir `personal?: true` a las tres variantes de categoría en `data-model.md`, con la nota de que `false` se rechaza
  (para desmarcar se quita la clave). En W43: «las categorías con `personal: true` muestran un aviso; ninguna casilla viene
  marcada».
- **Verificación**: no aplica (documentación).

---

## Hallazgos de la revisión de cierre de T393–T396 (2026-11-17)

Revisión hecha con Opus sobre `git diff 98216e6 d13710d`, con escenarios ejecutados en tests temporales (ya borrados). C-10
es anterior al grupo; C-11 a C-14 se derivan de él.

## C-10 (Media) — Se puede reembolsar una compra real en `chargeback` (o en `pending`)

- **Requisito**: BE-FR-27, BE-FR-28; `data-model.md` 4.5 (el reembolso solo sale de `completed` o `partially_refunded`).
- **Fichero**: `src/lib/server/features/payments/domain/refund.ts` (`planRefund`): en compras reales no se miraba `status`;
  solo en las simuladas.
- **Estado**: corregido (T402, 2026-11-17). Reproducido con 4 tests (3 de dominio y 1 de integración) y verificado con
  `test:related`, la cobertura del 100 % del dominio de `payments` y `lint:changed`.
- **Qué pasaba**: compra real de 1000 céntimos → `chargeback_opened` (rectificativa −1000, estado `chargeback`) → reembolso de
  500 aceptado: estado `partially_refunded`, rectificativa −500 (−1500 sobre 1000), el informe contable pasaba a contracargo 0 y
  la cuenta seguía bloqueada. En `pending` (real), el reembolso la sacaba de `pending` y el `payment_completed` posterior se
  ignoraba: nunca se acreditaban los créditos.
- **Cambio**: en compras reales, `not_completed` (→ `PAYMENT_NOT_REFUNDABLE`, con mensaje ya existente en W37) si `status` no
  es `completed` ni `partially_refunded`, antes de comprobar el importe.

## C-11 (Media) — El contracargo en `refunded` sí retira créditos si el reembolso no los retiró todos

- **Requisito**: `data-model.md` 4.5 (fila añadida en T393); BE-FR-28; D01.
- **Ficheros**: `data-model.md` 4.5 y el comentario de `applyEvent` en `src/lib/server/features/payments/service.ts`.
- **Estado**: corregido (T403, 2026-11-17). El código ya era coherente con H-12; lo incorrecto era el documento.
- **Qué pasaba**: compra de 10.500 créditos, reembolso total de 1000 céntimos retirando solo 5.000 (D01 lo permite), después
  `chargeback_opened`: movimiento `chargeback` de −5.500. La fila de T393 decía «sin movimiento de créditos».
- **Decisión del propietario (2026-11-17)**: se retiran. El contracargo retira lo que quede de la compra en cualquier estado de
  origen (0 si los reembolsos retiraron todo); lo consumido pasa a deuda sin tope.
- **Tests**: dos casos en `refund-chargeback.int.test.ts` (sin consumo: −5.500 de la bolsa; con 3.000 consumidos: −2.500 de la
  bolsa y −3.000 a deuda), con la cuenta bloqueada y sin rectificativa nueva.

## C-12 (Baja) — El reintento de C-04 no se puede hacer desde la interfaz y el aviso no identifica la compra

- **Requisito**: BE-FR-27; `contracts/log-events.md` 3.9.
- **Ficheros**: `src/lib/server/features/payments/service.ts` (`correctRefund`),
  `src/routes/(web)/admin/usuarios/[userId]/pagos/[paymentId]/reembolso/+page.server.ts`.
- **Estado**: confirmado por lectura.
- **Qué pasa**: cada carga de W37 genera una clave nueva y el éxito redirige con 303: el administrador no ve que falta la
  rectificativa ni puede reenviar la misma clave (un envío nuevo es otro reembolso). `payments.refund.corrective_pending` solo
  lleva `reason`, sin `err`, y el `catch` también se traga los errores de programación.
- **Cambio**: añadir `err` al evento (campo propio del contrato); documentar en `docs/operaciones/` una consulta que liste las
  compras con `refunded_eur_cents` mayor que la suma de sus rectificativas `refund:*`; opcional, mostrarlo en el detalle del
  pago. Corregir en C-04 que el reintento solo ocurre si se reenvía la misma petición.
- **Test**: con `correctPayment` que lanza, el evento lleva `err`.

## C-13 (Baja) — El reenvío con la misma clave y otro importe emite la rectificativa con ese importe

- **Requisito**: BE-FR-27, BE-FR-75.
- **Fichero**: `src/lib/server/features/payments/service.ts` (`repeatedRefund` usa `input.amountEurCents` del reenvío).
- **Estado**: confirmado por ejecución.
- **Qué pasa**: reembolso de 400 con la clave K y rectificativa fallida; reenvío de K con importe 900 → rectificativa −900 con
  `issueKey` `refund:<id>:400`. `invoicing` no compara el importe al deduplicar. Requiere una petición manipulada o un navegador
  que restaure el campo oculto.
- **Cambio**: guardar `amount_eur_cents` y `refunded_after_eur_cents` en `refund_keys` (migración) y no tomar el importe del
  cliente en el camino repetido. Resuelve también el límite de C-04 (reintentar una clave que no es la última).
- **Test (primero, debe fallar)**: el escenario anterior da `correctiveAmounts` = `[-400]`.

## C-14 (Baja) — Con C-02, una operación más larga que `hold_ttl_seconds` deja de estar reservada

- **Requisito**: BE-FR-71 CA1, BE-FR-11.6, BE-FR-46.
- **Ficheros**: `src/lib/server/features/apps/json-schemas.ts` (`hold_ttl_seconds: PositiveInt`, sin relación con
  `timeout_ms`), `src/lib/server/features/credits/repository.ts` (`reservedOf`).
- **Estado**: confirmado por ejecución. Con los valores por defecto no ocurre (600 s de reserva frente a unos 137 s de
  operación).
- **Qué pasa**: si el administrador baja `hold_ttl_seconds` por debajo de lo que dura una operación, una reserva caducada y aún
  sin cobrar deja de contar: en una cuenta sin compra real, dos reservas de 300 con tope diario de 400 cobran 600; el freno
  global infravalora la exposición. `max_debt` sí se respeta (lo que no cabe lo absorbe el administrador).
- **Cambio**: al validar los ajustes, exigir que `hold_ttl_seconds × 1000` supere el mayor `operationTotalMs` de las
  operaciones activas más un margen; si no, anotar el compromiso en BE-FR-71.
- **Test**: `previewSettingChange('hold_ttl_seconds', 60)` se rechaza con las operaciones por defecto.

---

## Hallazgos de la revisión de autenticación y cuentas (2026-11-17)

Revisión hecha con Opus (fase 3 del plan, primera área), con escenarios R1–R9 ejecutados en un test temporal ya borrado. Las
decisiones del propietario del mismo día están recogidas en `Historias.md` 2.13 (BE-FR-05, BE-FR-45, BE-FR-66 y sección 13).

## C-15 (Media) — Los tokens pendientes sobreviven a los cambios de credenciales

- **Requisito**: BE-FR-05, BE-FR-66 CA2 y CA6.
- **Ficheros**: `src/lib/server/features/accounts/password-change.ts` (`changePassword`),
  `src/lib/server/features/accounts/service.ts` (`resetPassword`),
  `src/lib/server/features/accounts/email-change.ts` (`requestEmailChange`, `confirmEmailChange`).
- **Estado**: corregido (2026-11-17), con su test en rojo antes del cambio. Confirmado por ejecución.
- **Qué pasa**: un atacante que conoce la contraseña pide un cambio de email a su dirección; la víctima cambia o recupera la
  contraseña; el atacante confirma el enlace y el email cambia igualmente; después recupera la contraseña con el email nuevo. Al
  revés, un enlace de recuperación enviado al email antiguo sigue sirviendo tras el cambio de email.
- **Cambio**: en `changePassword` y `resetPassword`, dentro de la transacción, borrar los cambios de email pendientes del
  usuario; en `confirmEmailChange`, borrar sus `reset-password:*`. **Decisión del propietario**: avisar también al email actual
  al solicitar el cambio (plantilla nueva), además del aviso al aplicarse.
- **Test (primero, debe fallar)**: cambio de email pedido + `changePassword` (y + `resetPassword`) → la confirmación da token
  inválido; recuperación pedida + cambio de email aplicado → el token de recuperación ya no es válido; la solicitud envía el
  aviso al email actual.

## C-16 (Media) — Carrera en el bloqueo de login por fallos

- **Requisito**: BE-FR-67, BE-FR-45.
- **Fichero**: `src/lib/server/features/accounts/service.ts` (`authenticate`): lee el contador antes de `await signInEmail` y
  escribe después.
- **Estado**: confirmado por ejecución: 30 intentos simultáneos con `login_max_failures` = 10 llegaron todos a comprobar la
  contraseña, y el último, correcto, entró.
- **Cambio**: reservar el intento de forma atómica (`immediateTransaction`) antes de comprobar la contraseña; si el login va
  bien, limpiar.
- **Test (primero, debe fallar)**: N intentos con `Promise.all`; como mucho `login_max_failures` llegan a comprobar la
  contraseña y un acierto tras el umbral devuelve `LOCKED`.

## C-17 (Media) — Enumeración de cuentas por el tiempo de respuesta

- **Requisito**: BE-FR-01 CA5; contratos W10 y W12.
- **Fichero**: `src/lib/server/features/accounts/service.ts` (`register`, `resendVerification`, `requestPasswordReset`).
- **Estado**: confirmado por ejecución con un envío de 300 ms: recuperación 306 ms si la cuenta existe y 0 ms si no.
- **Cambio** (**decisión del propietario**): enviar los emails sin esperar su resultado, registrando el fallo en el log sin
  PII.
- **Test (primero, debe fallar)**: con un envío lento, la diferencia entre cuenta existente e inexistente es menor que 50 ms.

## C-18 (Media) — No se envía el aviso de seguridad al cambiar la contraseña

- **Requisito**: BE-FR-05 (5.13).
- **Fichero**: `src/lib/server/features/accounts/password-change.ts`.
- **Estado**: corregido (2026-11-17), con su test en rojo antes del cambio. Confirmado por ejecución (0 emails).
- **Cambio**: enviar el aviso tras el commit, como `resetPassword`.
- **Test (primero, debe fallar)**: tras `changePassword`, el buzón de prueba recibe el aviso.

## C-19 (Baja) — La confirmación del cambio de email no sigue el contrato W14

- **Requisito**: BE-FR-66 CA5; `contracts/web-routes.md` (W14).
- **Ficheros**: `src/routes/(web)/(public)/email/confirmar/+page.server.ts`, `src/lib/server/features/accounts/email-change.ts`.
- **Estado**: confirmado por lectura: devuelve 200 también con error, no redirige y revoca también la sesión actual.
- **Cambio** (**decisión del propietario: manda el contrato**): conservar la sesión actual, redirigir con
  `?aviso=email_changed` y responder 400 con los tokens inválidos.
- **Test (primero, debe fallar)**: test de datos (la sesión actual sigue viva) y `test:http` (303 y 400).

## C-20 (Baja) — Usar un enlace de recuperación no anula los anteriores

- **Requisito**: BE-FR-05.
- **Fichero**: `src/lib/server/features/accounts/service.ts` (`resetPassword`).
- **Estado**: corregido (2026-11-17), con su test en rojo antes del cambio. Confirmado por ejecución.
- **Cambio**: borrar todos los `reset-password:*` del usuario al recuperar o cambiar la contraseña (junto con C-15).
- **Test (primero, debe fallar)**: dos recuperaciones, se usa la segunda; la primera ya no es válida.

## C-21 (Baja) — Carrera en el límite de registros por IP

- **Requisito**: BE-FR-11.4, BE-FR-45.
- **Fichero**: `src/lib/server/features/accounts/service.ts` (`register`): `countSignupsFromIp` antes de `await signUpEmail`.
- **Estado**: confirmado por ejecución: 8 registros simultáneos con límite 3 crean 8 cuentas (el captcha lo dificulta).
- **Cambio**: reservar el hueco de forma atómica, con el mismo patrón que C-16.
- **Test (primero, debe fallar)**: N registros simultáneos desde una IP; como mucho 3 crean cuenta.

## C-22 (Baja) — El administrador puede bloquearse a sí mismo

- **Requisito**: administración de usuarios; `Historias.md` 13 (2026-11-17).
- **Fichero**: `src/lib/server/features/accounts/admin-users.ts` (`blockUser`).
- **Estado**: confirmado por ejecución: con un único administrador, la cuenta queda bloqueada y `ADMIN_EMAIL` no la recupera.
- **Cambio** (**decisión del propietario**): rechazar el bloqueo de la propia cuenta con un error tipado.
- **Test (primero, debe fallar)**: `blockUser` con el mismo administrador como actor y destino devuelve el error.

## C-23 (Baja) — No se puede cambiar el email a la propia forma normalizada

- **Requisito**: BE-FR-66 CA3, BE-FR-11 CA1.
- **Fichero**: `src/lib/server/features/accounts/email-change.ts`.
- **Estado**: confirmado por ejecución: `pepe+trabajo@ejemplo.es` no puede pasar a `pepe@ejemplo.es` (libre); responde
  `sent` y no envía nada.
- **Cambio** (**decisión del propietario**): permitirlo cuando la cuenta que coincide es la propia.
- **Test (primero, debe fallar)**: el escenario anterior envía el enlace de verificación y al confirmarlo cambia el email.

## C-24 (Baja) — Sin límite de intentos en el cambio de contraseña ni en la eliminación de cuenta

- **Requisito**: BE-FR-45 (ampliado en `Historias.md` 2.13).
- **Ficheros**: `src/lib/server/features/accounts/password-change.ts`,
  `src/lib/server/features/privacy/service.ts` (`deleteAccount`).
- **Estado**: confirmado por lectura.
- **Cambio** (**decisión del propietario**): limitar los dos por cuenta, con el umbral y la ventana de BE-FR-67 y un contador
  atómico.
- **Test (primero, debe fallar)**: tras `login_max_failures` contraseñas actuales erróneas, el siguiente intento se rechaza
  aunque la contraseña sea la correcta.

## C-25 (Baja) — Turnstile no valida `hostname` ni `action`

- **Requisito**: BE-FR-01 (captcha).
- **Fichero**: `src/lib/server/adapters/turnstile/turnstile-verifier.ts`.
- **Estado**: confirmado por lectura.
- **Cambio**: comprobar que `hostname` es el host web y `action` la del registro.
- **Test (primero, debe fallar)**: una respuesta con otro `hostname` se rechaza.

Menores sin número: `closeOtherSession` duplicada y sin exportar en `accounts/sessions.ts` (código muerto); `requireAppSession`
no comprueba `banned` (no explotable hoy: el bloqueo borra las sesiones y Better Auth no crea sesiones de cuentas bloqueadas).
