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
| C-26 | Media    | api      | `GET /api/v1/defaults` no exige sesión Bearer                                            | T418  |
| C-27 | Media    | accounts | Un login en curso sobrevive a una revocación concurrente                                 | T419  |
| C-28 | Media    | legal    | La aceptación de términos desde la API registra `app_id` nulo                            | T420  |
| C-29 | Baja     | api      | El orden de las comprobaciones de la API no sigue el contrato 1.8                        | T421  |
| C-30 | Baja     | web      | Un fallo al cargar la sesión responde 500 sin `X-Request-Id` ni cabeceras de seguridad   | T422  |
| C-31 | Baja     | accounts | Faltan eventos de revocación de sesiones o están incompletos                             | T423  |
| C-32 | Media    | config   | Nada garantiza las variables del proxy en el despliegue, y la imagen usa el puerto 3000  | T424  |
| C-33 | Media    | accounts | Los límites por IP cuentan la dirección IPv6 completa                                    | T425  |
| C-34 | Media    | accounts | El reenvío de verificación y la recuperación no tienen límite por email                  | T426  |
| C-35 | Baja     | accounts | El cliente puede fijar la IP de su sesión con la cabecera `x-mm-client-ip`               | T427  |
| C-36 | Baja     | accounts | Los intentos de registro no tienen límite por IP                                         | T428  |
| C-37 | Baja     | web      | La web no muestra el tiempo de espera en los 429 `RATE_LIMITED`                          | T429  |
| C-38 | Baja     | logging  | En `/client-errors` un visitante agota el cupo global y el cuerpo se lee entero          | T430  |
| C-39 | Baja     | ai       | En `/ai/*` la frecuencia se cuenta antes que la idempotencia y la validación             | T431  |
| C-40 | Alta     | sync     | La copia de W43 borra de los predeterminados las categorías no seleccionadas             | T432  |
| C-41 | Media    | sync     | W42 y W43 no piden motivo y su auditoría no guarda valores                               | T433  |
| C-42 | Media    | web      | W42 pierde el JSON editado al fallar la validación y no dice qué categoría falla         | T434  |
| C-43 | Media    | sync     | Un GET o PUT de `/sync` durante el borrado de la cuenta recrea el documento              | T435  |
| C-44 | Baja     | sync     | Los eventos de `sync` y de W43 no siguen el catálogo de logging                          | T436  |
| C-45 | Baja     | sync     | La siembra no filtra por el esquema vigente                                              | T437  |
| C-46 | Baja     | sync     | La limpieza de marcas de borrado carga en memoria todos los documentos                   | —     |
| C-47 | Media    | web      | Los periodos del panel se cortan en días UTC y no en días de Madrid                      | T438  |
| C-48 | Media    | pricing  | El tipo de cambio manual no tiene rango ni validación de tipo                            | T439  |
| C-49 | Media    | freno    | El freno global convierte con el ajuste fijo y no con el tipo vigente                    | T440  |
| C-50 | Baja     | accounts | Cerrar una sesión inexistente o ajena no da 404 y se audita igualmente                   | T441  |
| C-51 | Baja     | web      | Varias acciones auditadas no enlazan con su entrada de auditoría (UX-13)                 | T442  |
| C-52 | Baja     | apps     | Editar, aplicar al grupo y activar una operación aceptan un motivo vacío                 | T443  |
| C-53 | Baja     | web      | Una `pagina` enorme en los filtros GET del panel da 500                                  | T444  |

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
- **Estado**: corregido (2026-11-18). Migración 0017 (T397), con su test en rojo antes del cambio. Confirmado por lectura (revisión del PR #47 y comprobación manual del seed y de `drizzle/`).
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
- **Estado**: corregido (2026-11-18), como cobertura y no como defecto: el aviso ya se pintaba solo en `prompts`; faltaba el test (T398). Caso HTTP en `admin-predeterminados.test.ts`, que falla con `{#if category.personal}` sustituido por `{#if false}` (comprobado). Se quitó el test unitario «no preselecciona».
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
- **Estado**: corregido (2026-11-18). Orden de despliegue y vuelta atrás en `docs/operaciones/migraciones.md` (T399). La vuelta atrás en staging no está verificada. Antes: confirmado por lectura que la versión anterior (`z.strictObject` sin `personal`) rechaza la clave; el alcance exacto
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
- **Estado**: corregido (2026-11-18), vía (a): prop `description` en `CheckboxGroup` (T400). Descripción accesible comprobada con testing-library y Playwright (E2E y `test:e2e:a11y`); el efecto en un lector de pantalla real no se ha verificado.
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
- **Estado**: corregido (T401, 2026-11-17), comprobado contra `apps/json-schemas.ts` y `apps/defaults.ts`.
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
- **Estado**: corregido (2026-11-18). Confirmado por lectura. Con su test en rojo antes del cambio (T404).
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
- **Estado**: corregido (2026-11-18). Confirmado por ejecución, con su test en rojo antes del cambio (T405). Las claves anteriores a 0018 quedan con las columnas nulas y su reenvío no reintenta la rectificativa.
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
- **Estado**: corregido (2026-11-18). Con su test en rojo antes del cambio (T406); el mínimo se calcula sobre todas las operaciones, también las inactivas. Antes: confirmado por ejecución. Con los valores por defecto no ocurre (600 s de reserva frente a unos 137 s de
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
- **Estado**: corregido (2026-11-17), con su test en rojo antes del cambio. Confirmado por ejecución: 30 intentos simultáneos con `login_max_failures` = 10 llegaron todos a comprobar la
  contraseña, y el último, correcto, entró.
- **Cambio**: reservar el intento de forma atómica (`immediateTransaction`) antes de comprobar la contraseña; si el login va
  bien, limpiar.
- **Test (primero, debe fallar)**: N intentos con `Promise.all`; como mucho `login_max_failures` llegan a comprobar la
  contraseña y un acierto tras el umbral devuelve `LOCKED`.

## C-17 (Media) — Enumeración de cuentas por el tiempo de respuesta

- **Requisito**: BE-FR-01 CA5; contratos W10 y W12.
- **Fichero**: `src/lib/server/features/accounts/service.ts` (`register`, `resendVerification`, `requestPasswordReset`).
- **Estado**: corregido (2026-11-17), con su test en rojo antes del cambio. Confirmado por ejecución con un envío de 300 ms: recuperación 306 ms si la cuenta existe y 0 ms si no.
  El reenvío de verificación y el registro de un email ya existente igualan además el suelo de tiempo constante (500 ms)
  de `sendVerificationEmail` de Better Auth: el reenvío lo llama siempre, y el registro duplicado lo llama sobre una
  dirección `.invalid` que no envía nada. Los fallos de envío quedan en `accounts.email.dispatch_failed`.
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
- **Estado**: corregido (2026-11-17), con su test en rojo antes del cambio. Confirmado por lectura: devuelve 200 también con error, no redirige y revoca también la sesión actual.
  Una dirección que ya no está libre responde `400 TOKEN_INVALID` con su propio mensaje.
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
- **Estado**: corregido (2026-11-17), con su test en rojo antes del cambio. Confirmado por ejecución: 8 registros simultáneos con límite 3 crean 8 cuentas (el captcha lo dificulta).
- **Cambio**: reservar el hueco de forma atómica, con el mismo patrón que C-16.
- **Test (primero, debe fallar)**: N registros simultáneos desde una IP; como mucho 3 crean cuenta.

## C-22 (Baja) — El administrador puede bloquearse a sí mismo

- **Requisito**: administración de usuarios; `Historias.md` 13 (2026-11-17).
- **Fichero**: `src/lib/server/features/accounts/admin-users.ts` (`blockUser`).
- **Estado**: corregido (2026-11-17), con su test en rojo antes del cambio. Confirmado por ejecución: con un único administrador, la cuenta queda bloqueada y `ADMIN_EMAIL` no la recupera.
  El error es `409 CANNOT_BLOCK_SELF`.
- **Cambio** (**decisión del propietario**): rechazar el bloqueo de la propia cuenta con un error tipado.
- **Test (primero, debe fallar)**: `blockUser` con el mismo administrador como actor y destino devuelve el error.

## C-23 (Baja) — No se puede cambiar el email a la propia forma normalizada

- **Requisito**: BE-FR-66 CA3, BE-FR-11 CA1.
- **Fichero**: `src/lib/server/features/accounts/email-change.ts`.
- **Estado**: corregido (2026-11-17), con su test en rojo antes del cambio. Confirmado por ejecución: `pepe+trabajo@ejemplo.es` no puede pasar a `pepe@ejemplo.es` (libre); responde
  `sent` y no envía nada.
- **Cambio** (**decisión del propietario**): permitirlo cuando la cuenta que coincide es la propia.
- **Test (primero, debe fallar)**: el escenario anterior envía el enlace de verificación y al confirmarlo cambia el email.

## C-24 (Baja) — Sin límite de intentos en el cambio de contraseña ni en la eliminación de cuenta

- **Requisito**: BE-FR-45 (ampliado en `Historias.md` 2.13).
- **Ficheros**: `src/lib/server/features/accounts/password-change.ts`,
  `src/lib/server/features/privacy/service.ts` (`deleteAccount`).
- **Estado**: corregido (2026-11-17), con su test en rojo antes del cambio. Confirmado por lectura.
- **Cambio** (**decisión del propietario**): limitarlos con un contador por cuenta separado del login y compartido con el
  cambio de email, con el umbral, la ventana y el bloqueo de BE-FR-67 y reserva atómica; un login correcto no lo limpia.
- **Test (primero, debe fallar)**: tras `login_max_failures` contraseñas actuales erróneas, el siguiente intento se rechaza
  aunque la contraseña sea la correcta.

## C-25 (Baja) — Turnstile no valida `hostname` ni `action`

- **Requisito**: BE-FR-01 (captcha).
- **Fichero**: `src/lib/server/adapters/turnstile/turnstile-verifier.ts`.
- **Estado**: corregido (2026-11-17), con su test en rojo antes del cambio. Confirmado por lectura. La comprobación solo se activa con Cloudflare real y una clave que no sea la
  de prueba (la clave de prueba de Cloudflare no devuelve `hostname` ni `action` reales).
- **Cambio**: comprobar que `hostname` es el host web y `action` la del registro.
- **Test (primero, debe fallar)**: una respuesta con otro `hostname` se rechaza.

Menores sin número: `closeOtherSession` duplicada y sin exportar en `accounts/sessions.ts` (código muerto; borrada con T413–T417); `requireAppSession`
no comprueba `banned` (no explotable hoy: el bloqueo borra las sesiones y Better Auth no crea sesiones de cuentas bloqueadas).

C-26 a C-31 proceden de la revisión de los tokens de la API (2026-11-17), hecha con Opus por lectura. C-26 a C-29 se han
confirmado después ejecutando sus tests de reproducción contra el código de 364645f; C-30 y C-31, releyendo el código.

## C-26 (Media) — `GET /api/v1/defaults` no exige sesión Bearer

- **Requisito**: BE-FR-42 CA2, BE-FR-65; `contracts/api-v1` E12 («(Bearer)», error `UNAUTHENTICATED`).
- **Ficheros**: `src/routes/api/v1/defaults/+server.ts` (solo `requireApp` y `guardEndpoint`), `src/lib/server/api/openapi.ts`
  (solo documenta 200 y 426), `tests/http/api-sync.test.ts` (llama sin Bearer y espera 200).
- **Estado**: corregido (2026-11-17), con su test en rojo antes del cambio. confirmado por ejecución: sin Bearer y con un Bearer inventado responde 200.
- **Cambio** (**decisión del propietario: exigir el token**, como dice E12): `requireAppSession` después de `requireApp` y antes
  de `guardEndpoint`; 401 en el OpenAPI; `api-sync.test.ts` envía el Bearer. `plan.md` («solo aplica la de versión») se
  refiere a la exención de mantenimiento y de documentos legales (D-19), no a la sesión.
- **Test (primero, debe fallar)**: sin Bearer y con un Bearer inventado → 401 `UNAUTHENTICATED`; con el Bearer de la app → 200.

## C-27 (Media) — Un login en curso sobrevive a una revocación concurrente

- **Requisito**: BE-FR-04 CA2 y CA4, BE-FR-06, BE-FR-07.
- **Ficheros**: `src/lib/server/features/accounts/service.ts` (`authenticate`, que llama a `auth.api.signInEmail`: Better Auth lee
  el usuario, espera el hash y crea la sesión sin volver a leer la credencial); `src/hooks.server.ts` (`loadSession`) y
  `src/lib/server/api/session.ts` (`requireAppSession`), que no comprueban `deletedAt` ni `banned`.
- **Estado**: corregido (2026-11-17), con su test en rojo antes del cambio (`accounts/login-race.int.test.ts`, 6 casos, también el
  cambio de email). El rechazo cuenta como una contraseña errónea (`INVALID_CREDENTIALS`, BE-FR-67 CA1). Confirmado por
  ejecución: con el hash detenido a mitad del login, borrar la cuenta o cambiar la contraseña deja
  viva la sesión que el login crea después (30 días deslizantes). El bloqueo por el administrador no se ve afectado: el plugin
  `admin` vuelve a leer `banned` al crear la sesión.
- **Cambio**: instantánea antes de `signInEmail` (hash de la contraseña, email y `deletedAt`); después, en una
  `immediateTransaction`, volver a leerlos y, si algo cambió o la credencial ya no existe, borrar la sesión recién creada y
  responder `INVALID_CREDENTIALS`. Defensa en profundidad: tratar como sin sesión la de un usuario con `deletedAt` o `banned`.
- **Test (primero, debe fallar)**: con una «puerta» en la verificación del hash, un login en curso cuando se borra la cuenta o
  se cambia la contraseña no deja ninguna sesión válida.

## C-28 (Media) — La aceptación de términos desde la API registra `app_id` nulo

- **Requisito**: BE-FR-70 CA2; `contracts/api-v1` E06 («registra … app_id»); `data-model.md` (`terms_acceptances.app_id`: nulo
  = web).
- **Fichero**: `src/lib/server/features/legal/accept-documents.ts` (`appId: null` fijo).
- **Estado**: corregido (2026-11-17), con su test en rojo antes del cambio. confirmado por ejecución: la fila de `POST /api/v1/me/accept-terms` lleva `app_id` nulo.
- **Cambio**: `acceptDocuments` recibe `appId`; la ruta de la API pasa el id de la app y la web sigue pasando `null`.
- **Test (primero, debe fallar)**: la fila de `terms_acceptances` creada desde la API lleva el id de `secretario`.

## C-29 (Baja) — El orden de las comprobaciones de la API no sigue el contrato 1.8

- **Requisito**: `contracts/api-v1` 1.8 (app → Origin → límite → sesión 401 → versión 426 → mantenimiento → … → validación).
- **Ficheros**: `src/routes/api/v1/me/+server.ts` y `me/accept-terms/+server.ts` (`guardEndpoint` antes de `requireAppSession`);
  `src/routes/api/v1/auth/logout/+server.ts` (valida el cuerpo antes de comprobar la app y la sesión).
- **Estado**: corregido (2026-11-17), con su test en rojo antes del cambio. confirmado por ejecución: `/me` y `/me/accept-terms` sin Bearer y con versión antigua responden 426; logout sin
  Bearer responde 400, y con app desconocida, `VALIDATION_ERROR`.
- **Cambio**: en todas las rutas de `/api/v1`, `requireApp` → `requireAppSession` → `guardEndpoint` → validación del cuerpo.
- **Test (primero, debe fallar)**: los cuatro casos anteriores responden 401 o `UNKNOWN_APP`.

## C-30 (Baja) — Un fallo al cargar la sesión responde 500 sin `X-Request-Id` ni cabeceras de seguridad

- **Requisito**: constitución (errores y logging); `contracts/api-v1` 1.x (toda respuesta lleva `X-Request-Id`) y formato de
  error 7.1.
- **Fichero**: `src/hooks.server.ts`: `loadSession` llama a `readSession` y `touchActivity` sin capturar errores, y
  `requestContext` solo pone `x-request-id` y las cabeceras de seguridad cuando `resolve` termina bien.
- **Estado**: corregido (2026-11-17), con su test en rojo antes del cambio. confirmado por lectura: una excepción no HTTP sale de `requestContext` sin esas cabeceras; el cuerpo lo genera
  SvelteKit y no tiene la forma `{ error: { code, … } }` en la API.
- **Cambio**: en la API, capturar el fallo de `loadSession` y responder `INTERNAL_ERROR` con el formato 7.1, registrándolo una
  vez; `requestContext` pone las cabeceras también en el camino de error.
- **Test (primero, debe fallar)**: con `readSession` que lanza, una petición a la API responde 500 `INTERNAL_ERROR` con
  `X-Request-Id` y las cabeceras de seguridad.

## C-31 (Baja) — Faltan eventos de revocación de sesiones o están incompletos

- **Requisito**: `contracts/log-events.md` (`accounts.session.revoked` con `reason` y `count`; `accounts.password.changed` y
  `accounts.email_change.applied` con `count`; `apps.app.rejected` con `errorCode`).
- **Ficheros**: `accounts/password-change.ts` (`count: 1` fijo y sin `session.revoked`), `accounts/service.ts` (`resetPassword`
  sin `session.revoked`; `logout` y el bloqueo por contracargo sin `count`), `accounts/email-change.ts` (sin `session.revoked`;
  `applied` usa `sessionsClosed` en vez de `count`), `accounts/close-session.ts` y `routes/(web)/panel/sesiones` (nunca emiten
  `user_closed_one` ni `user_closed_others`), `src/lib/server/api/session.ts` (`apps.app.rejected` sin `errorCode`).
- **Estado**: corregido (2026-11-17), con su test en rojo antes del cambio. confirmado por lectura.
- **Cambio**: emitir `accounts.session.revoked` aparte, con su motivo y el número real de sesiones borradas, en cada
  revocación; `count` real en `password.changed` y `email_change.applied`; `errorCode` en `apps.app.rejected`.
- **Test (primero, debe fallar)**: con el logger de prueba, cada revocación emite `accounts.session.revoked` con su motivo y su
  `count`.

C-32 a C-39 proceden de la revisión de protecciones y límites (2026-11-17), hecha con Opus por lectura. Todos salvo C-36 se
han confirmado después ejecutando sus tests de reproducción contra el código de 44150eb. Las decisiones del propietario
(C-32, C-34 y C-36) están en `Historias.md` 2.14 y en la tabla de la sección 13.

## C-32 (Media) — Nada garantiza las variables del proxy en el despliegue, y la imagen usa el puerto 3000

- **Requisito**: constitución, «Proxy, puerto e IP del cliente» y tabla de variables (`ADDRESS_HEADER=x-forwarded-for`,
  `XFF_DEPTH=1`, `PROTOCOL_HEADER`; `PORT` 7311 en producción y 7312 en staging; el 3000 está prohibido); BE-FR-45, BE-FR-11.
- **Ficheros**: `src/lib/server/config/env-schema.ts` (las tres variables con `default`, que solo ve la app: adapter-node lee
  `process.env`), `Dockerfile` (`PORT=3000`, `EXPOSE 3000` y ninguna de las tres variables).
- **Estado**: corregido (2026-11-17), con su test en rojo antes del cambio. Confirmado por ejecución: el esquema aceptaba producción y staging sin las variables, y la imagen no las fija y
  escucha en el 3000. Si el despliegue no las define, `getClientAddress()` devuelve la IP del proxy y todos los usuarios
  comparten los límites por IP.
- **Cambio** (**decisión del propietario: exigir y fijar**): en staging y producción el arranque falla si falta alguna de las
  tres; el Dockerfile las fija junto con `PORT=7311` y `EXPOSE 7311`. **Antes de desplegar en `main`**, comprobar que
  Coolify apunta al puerto 7311. No se rechazan puertos en el esquema (opción descartada).
- **Test (primero, debe fallar)**: el esquema rechaza producción y staging sin las variables nombrándolas; el Dockerfile las
  fija y no usa el 3000.

## C-33 (Media) — Los límites por IP cuentan la dirección IPv6 completa

- **Requisito**: BE-FR-45, BE-FR-11 (altas por IP); `contracts/web-routes.md` 1.7.
- **Ficheros**: `src/lib/server/features/accounts/service.ts` (`ipRateLimited` usa la IP tal cual), `accounts/repository.ts`
  (`bumpRateCounter`, `reserveSignupSlot` y el recuento sobre `user.signup_ip`).
- **Estado**: corregido (2026-11-17), con su test en rojo antes del cambio. Confirmado por ejecución: logins y altas desde direcciones distintas del mismo /64 no compartían contador. Funciones puras en `accounts/domain/ip-key.ts` (`canonicalIp`, `rateLimitKeyOf`, `signupIpMatchOf`). `user.signup_ip` se guarda en forma canónica completa y las altas se cuentan por rango de texto del /64, sin migración. Efecto transitorio: las altas de las 24 h previas guardadas con IPv6 comprimida no entran en el recuento, y las filas antiguas de `auth_rate_limits` con IPv6 en bruto no coinciden con las claves /64 hasta que caduquen.
- **Cambio**: una clave de límite que agrupe IPv6 por /64 y deje IPv4 igual (el criterio de `ipv6Subnet` de Better Auth), usada
  en todos los límites por IP, también en el de altas. Si exige una columna nueva o una migración, detente y anótalo.
- **Test (primero, debe fallar)**: logins y altas desde el mismo /64 comparten el límite.

## C-34 (Media) — El reenvío de verificación y la recuperación no tienen límite por email

- **Requisito**: BE-FR-45 (2.14); BE-FR-02 CA3; `contracts/api-v1` E03 (al superar el límite por email no se envía).
- **Ficheros**: `accounts/service.ts` (`resendVerification`, `requestPasswordReset`: solo límite por IP); `apps/defaults.ts`,
  `apps/json-schemas.ts` y `/admin/protecciones` (ajustes).
- **Estado**: corregido (2026-11-17), con su test en rojo antes del cambio. Confirmado por ejecución: desde 10 IP se enviaban 10 emails a la misma dirección y se creaban 10 enlaces de
  recuperación.
- **Cambio** (**decisión del propietario: 3 por hora**): contador por HMAC del email normalizado con los ajustes
  `resend_verification_per_email_hour` y `password_reset_per_email_hour` (3, editables con su rango); al superarlo no se
  envía nada y la respuesta es la misma.
- **Test (primero, debe fallar)**: desde muchas IP no se envían ni se crean más de 3 por hora para la misma dirección.

## C-35 (Baja) — El cliente puede fijar la IP de su sesión con la cabecera `x-mm-client-ip`

- **Requisito**: constitución, «Fuente única de la IP del cliente» (`event.getClientAddress()`).
- **Ficheros**: `accounts/auth.ts` (`ipAddressHeaders: ['x-mm-client-ip']`; el comentario dice que se borra si llega del
  cliente, y no se borra), `accounts/password-change.ts` (pasa las cabeceras de la petición a `auth.api.changePassword`),
  `src/hooks.server.ts`.
- **Estado**: corregido (2026-11-17), con su test en rojo antes del cambio. También se quita `x-mm-client-ip` de toda petición en `hooks.server.ts` (sin test HTTP propio). Confirmado por ejecución: al cambiar la contraseña con `x-mm-client-ip: 6.6.6.6`, la sesión nueva guarda esa IP,
  que se ve en `/panel/sesiones` y en la ficha del administrador.
- **Cambio**: quitar `x-mm-client-ip` de toda petición entrante y, en `changePassword`, pasar cabeceras construidas con la IP
  real (`headersFor`) más la cookie; corregir el comentario de `auth.ts`.
- **Test (primero, debe fallar)**: la sesión creada al cambiar la contraseña no toma la IP de esa cabecera.

## C-36 (Baja) — Los intentos de registro no tienen límite por IP

- **Requisito**: BE-FR-45 (2.14); `contracts/web-routes.md` 1.7 y W08 (`429 RATE_LIMITED`).
- **Fichero**: `accounts/service.ts` (`register`: solo cuenta las cuentas creadas).
- **Estado**: corregido (2026-11-17), con su test en rojo antes del cambio. Confirmado por lectura. Sin migración: el contador va en el ámbito `signup` con la clave `attempt:<clave IP>`. En E2E, `E2E_SIGNUP_ATTEMPTS_PER_IP_HOUR` (no verificado: no se ha ejecutado E2E).
- **Cambio** (**decisión del propietario: 10 por hora**): `ipRateLimited` con el ámbito de registro y el ajuste
  `signup_attempts_per_ip_hour` (10, editable con su rango), antes de comprobar el captcha.
- **Test (primero, debe fallar)**: el intento 11 desde una IP en una hora responde `RATE_LIMITED` sin llamar a Turnstile.

## C-37 (Baja) — La web no muestra el tiempo de espera en los 429 `RATE_LIMITED`

- **Requisito**: `contracts/web-routes.md` 1.7 («con el tiempo de espera visible»); W11, W12, W27.
- **Ficheros**: `src/lib/server/web/actions.ts` (`failureOf` solo copia `retryAfterMinutes`), la ruta de W10 (conversión a mano).
- **Estado**: corregido (2026-11-17), con su test en rojo antes del cambio. Confirmado por ejecución: `failureOf` no devolvía los minutos cuando el error trae `retryAfterSeconds`.
- **Cambio**: `failureOf` convierte `retryAfterSeconds` a minutos con `Math.ceil`; quitar la conversión de W10.
- **Test (primero, debe fallar)**: un `RATE_LIMITED` con `retryAfterSeconds` da sus minutos redondeados hacia arriba.

## C-38 (Baja) — En `/client-errors` un visitante agota el cupo global y el cuerpo se lee entero

- **Requisito**: W52 (límite por visitante y uno global; entrada de 4 KB como máximo).
- **Ficheros**: `src/lib/server/logging/client-errors.cache.ts` (suma al cupo global antes de mirar el del visitante),
  `src/routes/client-errors/+server.ts` (`request.text()` antes de comprobar el tamaño).
- **Estado**: corregido (2026-11-17), con su test en rojo antes del cambio. Confirmado por ejecución (el cupo); la lectura del cuerpo, por lectura. El tope está en `logging/client-errors.body.ts`.
- **Cambio**: comprobar primero el límite del visitante y después sumar al global; rechazar por `content-length` mayor de 4 KB
  antes de leer, o leer el cuerpo con un tope.
- **Test (primero, debe fallar)**: los informes rechazados por el límite del visitante no gastan el cupo global.

## C-39 (Baja) — En `/ai/*` la frecuencia se cuenta antes que la idempotencia y la validación

- **Requisito**: `contracts/api-v1` 1.8 (10 idempotencia, 11 validación, 12 frecuencia); BE-FR-81.
- **Ficheros**: `src/lib/server/features/ai/service.ts` (`runChat`: `guardRequest` antes de `admissionOf`), `ai/media.ts`
  (transcripción e imagen).
- **Estado**: corregido (2026-11-17), con su test en rojo antes del cambio. Confirmado por ejecución: los reintentos con una clave ya entregada respondían `RATE_LIMITED` en vez de
  `DUPLICATE_REQUEST`, y una operación inexistente gasta cupo.
- **Cambio**: separar en `guardRequest` el acceso y el freno (pasos 6 a 8), antes de la admisión, de la frecuencia y la
  concurrencia (paso 12), después de la validación.
- **Test (primero, debe fallar)**: los reintentos con clave entregada dan `DUPLICATE_REQUEST` y no gastan cupo; una operación
  inexistente da `VALIDATION_ERROR` y no gasta cupo.

C-40 a C-53 proceden de las revisiones de `sync` y de `admin` (2026-11-18), hechas con Opus por lectura. Todos los hallazgos con
test se confirmaron después por ejecución: de los 21 tests de integración, 19 fallan y 2 pasan (son de control), y los 15 tests
HTTP fallan los 15. C-46 es una sospecha sin test: hay que medirla con `pnpm perf:seed` antes de tocarla, y no tiene tarea.
Equivalencias con los informes: S-01 a S-07 son C-40 a C-46, y A-01 a A-07 son C-47 a C-53. Las decisiones del propietario
(2026-11-18) están en cada ficha (C-41, C-43, C-45, C-48 y C-49).

## C-40 (Alta) — La copia de W43 borra de los predeterminados las categorías no seleccionadas

- **Requisito**: BE-FR-42 CA3, FR-067; `contracts/web-routes.md` W43 («solo sustituye las categorías con algún elemento seleccionado»).
- **Ficheros**: `src/lib/server/features/sync/service.ts` (`applyCopyAsDefaults`, líneas 235–240: escribe con `writeDefaults` el
  resultado de `applyCopy`, que solo contiene lo seleccionado, y el upsert sustituye el documento entero).
- **Estado**: confirmado por ejecución. Con una selección parcial, los predeterminados quedan solo con las categorías copiadas;
  con una selección que no casa con nada (categoría o elementos que ya no existen) se guarda `{}` y se audita una copia.
- **Cambio**: dentro de la transacción, fusionar `{ ...actuales, ...copied }` y lanzar `NOTHING_SELECTED` si `copied` está
  vacío. No necesita decisión.
- **Test (primero, debe fallar)**: `src/lib/server/features/sync/copy-defaults-keeps-unselected.int.test.ts` (el primer caso deja
  solo `prompts` y el segundo deja `{}` y audita una copia).

## C-41 (Media) — W42 y W43 no piden motivo y su auditoría no guarda valores

- **Requisito**: BE-FR-55 (valores anterior y nuevo, y motivo); `contracts/web-routes.md` 1.4 (el motivo es obligatorio); T321
  cuenta estas dos acciones en la matriz de motivo obligatorio.
- **Ficheros**: `sync/service.ts` (`updateDefaults` y `applyCopyAsDefaults`, líneas 192–204 y 241–253: `before: null`,
  `after: null` y un texto fijo como `reason`), las rutas de W42 y W43 (no leen `motivo`). La matriz de `admin-motivo.test.ts`
  pasa por casualidad: con `motivo=&confirmado=true` falla antes `JSON.parse('')` (W42) o `NOTHING_SELECTED` (W43).
- **Estado**: confirmado por ejecución. Con datos válidos y motivo vacío responde 303 y audita; con motivo, `reason` sigue
  siendo el texto fijo.
- **Cambio** (**decisión del propietario**): la auditoría guarda un resumen sin contenido (categorías cambiadas, número de
  elementos y un hash), no el JSON completo (puede romper la acción y mete datos personales en una tabla inmutable); y el
  motivo es obligatorio en W42 y W43 (`requireReason`).
- **Test (primero, debe fallar)**: `tests/http/admin-predeterminados-motivo.test.ts`.

## C-42 (Media) — W42 pierde el JSON editado al fallar la validación y no dice qué categoría falla

- **Requisito**: constitución, «Lo escrito no se pierde» y helper de formularios (`values` reenvía lo escrito); los mensajes de
  error explican qué ha pasado y dónde.
- **Ficheros**: la ruta de W42 `predeterminados/+page.server.ts` (líneas 53–60: `fail(400, { errors: { datos } })` o
  `failureOf(cause)` sin `values`; se descarta `verdict.field`) y su `+page.svelte` (líneas 28–30: pinta siempre
  `data.defaultsJson`).
- **Estado**: corregido (2026-11-18). W42 devuelve `values` con el JSON escrito y la categoría que falla (`category`), y la página los pinta. Test: tests/http/admin-predeterminados-conserva-texto.test.ts. Pasa tras el cambio; no se comprobó en rojo antes del cambio (copiado del repaso y verificado solo después). Antes: confirmado por ejecución. La respuesta 400 no contiene el texto enviado.
- **Cambio**: devolver `values` con el JSON enviado, pintarlo en la página y mostrar la categoría que falla. No necesita decisión.
- **Test (primero, debe fallar)**: `tests/http/admin-predeterminados-conserva-texto.test.ts`.

## C-43 (Media) — Un GET o PUT de `/sync` durante el borrado de la cuenta recrea el documento

- **Requisito**: BE-FR-07 CA1 (se borran los documentos sincronizados); RGPD, art. 17.
- **Ficheros**: `sync/service.ts` (`getSyncDocument` y `putSyncDocument`, líneas 87–141: no comprueban en su transacción que la
  cuenta siga viva), `src/routes/api/v1/sync/+server.ts` (líneas 33–49: valida la sesión y después hace `await jsonBodyOf(...)`,
  hueco en el que puede confirmarse `deleteAccount`). La retención no mira `sync_documents`, así que nada lo borra después.
- **Estado**: la carrera es una sospecha razonable, pero que el servicio no comprueba la cuenta borrada está confirmado por
  ejecución: tras el borrado, la llamada al servicio de una petición que ya había pasado la sesión deja una fila de
  `sync_documents` con el dato enviado.
- **Cambio** (**decisión del propietario**): triggers `BEFORE INSERT` y `BEFORE UPDATE` en `sync_documents` que abortan si
  `user.deleted_at` no es nulo, con su migración.
- **Test (primero, debe fallar)**: `src/lib/server/features/privacy/sync-after-delete.int.test.ts`.

## C-44 (Baja) — Los eventos de `sync` y de W43 no siguen el catálogo de logging

- **Requisito**: `contracts/log-events.md` 3.10; `contracts/api-v1` E10 y E11; `contracts/web-routes.md:623`.
- **Ficheros**: `sync/events.ts` (líneas 5–12), `sync/service.ts` (líneas 76–206).
- **Estado**: corregido (2026-11-18). eventos de `sync` alineados con `log-events.md` 3.10 (`read`, `written`, `schema_invalid`, `errorCode`, `if_match_invalid` en la ruta, `count`). Test: src/lib/server/features/sync/log-events-contract.int.test.ts. Pasa tras el cambio; no se comprobó en rojo antes del cambio (copiado del repaso y verificado solo después). Antes: confirmado por ejecución. Faltan `sync.document.read` (debug, `durationMs`) y `sync.document.written` (info,
  `durationMs`); `sync.document.rejected` usa `reason: 'validation'` en lugar de `schema_invalid`, no lleva `errorCode` y no se
  emite con `if_match_invalid`; `sync.tombstones.purged` lleva `removed` (uno por documento) en lugar de `count`;
  `sync.defaults.updated` y `sync.defaults.copied` no llevan `count`.
- **Cambio**: alinear los eventos con el catálogo. Si `read` y `written` se emiten en la ruta (donde se mide `durationMs`), el
  primer caso del test pasa a `tests/http/api-sync.test.ts`. No necesita decisión.
- **Test (primero, debe fallar)**: `src/lib/server/features/sync/log-events-contract.int.test.ts`.

## C-45 (Baja) — La siembra no filtra por el esquema vigente

- **Requisito**: BE-FR-39, BE-FR-40; `data-model.md` 3.3 («objeto con solo las categorías declaradas»).
- **Ficheros**: `sync/service.ts` (`documentOrSeed`, líneas 81–84), W40 (esquema de la app).
- **Estado**: confirmado por ejecución. Si el administrador quita o cambia la estrategia de una categoría en W40 después de
  guardar los predeterminados (`apps` no puede revalidar `app_defaults`, que es de `sync`), se siembra un documento que el
  propio servidor rechaza: el cliente que lo devuelve tal cual recibe `VALIDATION_ERROR` en cada PUT.
- **Cambio** (**decisión del propietario**): filtrar la siembra por el esquema vigente, y que W40 avise si el cambio invalida
  los predeterminados.
- **Test (primero, debe fallar)**: `src/lib/server/features/sync/seed-undeclared-categories.int.test.ts` (el documento sembrado
  contiene `retirada` y su reenvío responde `VALIDATION_ERROR`).

## C-46 (Baja) — La limpieza de marcas de borrado carga en memoria todos los documentos

- **Requisito**: rendimiento de `sync` (retención de marcas de borrado).
- **Ficheros**: `sync/service.ts` y `sync/repository.ts` (limpieza de `tombstones`).
- **Estado**: sospecha. Sin test y **sin tarea**: hay que medirla con `pnpm perf:seed` (antes y después) antes de tocar nada.
- **Cambio**: solo si la medición lo justifica, procesar por lotes o filtrar en SQL.
- **Test**: ninguno hasta medir.

## C-47 (Media) — Los periodos del panel se cortan en días UTC y no en días de Madrid

- **Requisito**: `Historias.md` 4.3 (los cortes diarios usan la zona `Europe/Madrid`); BE-FR-76 (por periodo); BE-FR-54.
- **Ficheros**: `bounds()` de facturación, exportación contable, estadísticas y filtro de auditoría
  (`Date.parse(`${desde}T00:00:00Z`)` y `${hasta}T23:59:59Z`); la fecha de cada fila del CSV es el día civil de Madrid
  (`civilDateOf`).
- **Estado**: corregido (2026-11-18). `madridPeriodBounds` en `shared/dates.ts` usada por facturación, exportación, estadísticas y auditoría. Test: tests/http/admin-periodo-madrid.test.ts y `dates.test.ts`. Pasa tras el cambio; no se comprobó en rojo antes del cambio (copiado del repaso y verificado solo después). Antes: confirmado por ejecución. Una venta del 1 de febrero a las 00:30 de Madrid (31-ene 23:30 UTC) no sale en el
  periodo 01-02..01-02, y una del 2 de febrero a las 00:30 sí sale en él, con fecha «2026-02-02» en un CSV del día 1. Además,
  el fin `23:59:59.000Z` deja fuera el último segundo.
- **Cambio**: una función común que devuelva `[madridMidnight(desde), madridMidnight(addDays(hasta, 1)))` y se use en los
  cuatro periodos. No necesita decisión.
- **Test (primero, debe fallar)**: `tests/http/admin-periodo-madrid.test.ts` (las dos primeras aserciones).

## C-48 (Media, dinero) — El tipo de cambio manual no tiene rango ni validación de tipo

- **Requisito**: BE-FR-61 CA2 (el panel valida tipos, rangos y coherencias); BE-FR-87 CA3.
- **Ficheros**: `admin/economia/+page.server.ts` (`?/fijarTipoCambioManual` pasa `Number(form.usdEurPpm)`), `pricing/service.ts`
  (`setManualFx`), `pricing/domain/charge.ts` (usa este tipo).
- **Estado**: confirmado por ejecución. Un valor absurdo (920 en lugar de 920 000) se guarda y cada operación se cobra unas
  1000 veces menos; un decimal, NaN o un negativo lanza `InvalidAmountError` y un 0 viola `fx_rates_usd_eur_positive`: la acción
  responde 500 en lugar de 400.
- **Cambio** (**decisión del propietario**): entero entre 500 000 y 2 000 000 ppm (0,50 a 2,00 €/USD), con `VALIDATION_ERROR`
  en el campo, y vista previa «antes → después» antes de confirmar.
- **Test (primero, debe fallar)**: `src/lib/server/features/pricing/fx-manual-range.int.test.ts`.

## C-49 (Media, dinero) — El freno global convierte con el ajuste fijo y no con el tipo vigente

- **Requisito**: BE-FR-87 CA1 (las operaciones usan el tipo vigente en el momento del cobro); `data-model.md` 2.5
  (`settings.fx_usd_eur` solo vale mientras no haya filas de `fx_rates`); BE-FR-46 (el freno es en euros).
- **Ficheros**: `src/lib/server/features/protections/service.ts:206` (`numberSetting(deps, 'fx_usd_eur')`, que nadie
  actualiza), el puerto `dailyCosts` que da `ai`, `tests/builders/protections.ts`.
- **Estado**: confirmado por ejecución. Con un tipo vigente de 2,0 €/USD, 3 USD son 600 céntimos (por encima de los 500 del
  freno), pero el freno calcula 276 (a 0,92) y no salta.
- **Cambio** (**decisión del propietario**): el puerto `dailyCosts` que da `ai` devuelve los céntimos ya convertidos con el
  tipo vigente de cada operación (`fx_rate_id`), sin aristas nuevas; ajustar `tests/builders/protections.ts`.
- **Test (primero, debe fallar)**: `src/lib/server/features/protections/brake-fx.int.test.ts` (la petición pasa en lugar de
  responder `SERVICE_LIMITED`); adaptarlo al puerto nuevo.

## C-50 (Baja) — Cerrar una sesión inexistente o ajena no da 404 y se audita igualmente

- **Requisito**: `contracts/web-routes.md` W35 (`?/cerrarSesiones` con errores `404`); BE-FR-55 (la auditoría registra cambios reales).
- **Ficheros**: `accounts/admin-users.ts` (`closeUserSessions`, líneas 224–247: filtra por cuenta y sesión, borra 0 filas y
  escribe `accounts.session.close` con `before: { sessions: 0 }`), la acción de `admin/usuarios/[userId]/+page.server.ts`.
- **Estado**: corregido (2026-11-18). `closeUserSessions` lanza `NOT_FOUND` sin auditar si una sesión concreta no se borra. Test: src/lib/server/features/accounts/admin-sessions-close.int.test.ts. Pasa tras el cambio; no se comprobó en rojo antes del cambio (copiado del repaso y verificado solo después). Antes: confirmado por ejecución. Devuelve 0 en lugar de lanzar `NOT_FOUND` y queda una entrada de auditoría.
- **Cambio**: `NOT_FOUND` sin auditar si `changes === 0`. No necesita decisión.
- **Test (primero, debe fallar)**: `src/lib/server/features/accounts/admin-sessions-close.int.test.ts`.

## C-51 (Baja) — Varias acciones auditadas no enlazan con su entrada de auditoría (UX-13)

- **Requisito**: UX-13 (`Historias.md` 16: al guardar se enlaza la entrada de auditoría; nombra el reembolso y el cierre de
  sesiones); `contracts/web-routes.md` sección 4 (`?aviso=saved&auditoria=<entryId>`).
- **Ficheros**: solo bloquear, desbloquear, tester y el ajuste usan `savedRedirect`. Sin enlace: `cerrarSesiones`
  (`usuarios/[userId]/+page.server.ts:276-277`), reembolso (`reembolso/+page.server.ts:162-164`, `?aviso=reembolso_aplicado`),
  economía (138, 154, 169, 187), protecciones (91, 124, 134), apps, operación, anuncios, legal y predeterminados. Los servicios
  afectados no devuelven el id de la entrada (`closeUserSessions` devuelve el número de sesiones; `setManualFx`,
  `updateSetting` y otros devuelven `void`).
- **Estado**: confirmado por ejecución. Las dos redirecciones del test no llevan `aviso=saved` ni `auditoria=`.
- **Cambio**: los servicios devuelven el id de su entrada de auditoría y las acciones redirigen con `savedRedirect`.
  Prioridad: reembolso y cierre de sesiones. `payments/service.ts` solo después de cerrar las fases 18 y 19, que ya están
  cerradas (commit a8b092c): se puede hacer.
- **Test (primero, debe fallar)**: `tests/http/admin-enlace-auditoria.test.ts`. El tipo manual se fija a 920 000 ppm (el valor
  por defecto) para no cambiar el cobro de las demás pruebas HTTP.

## C-52 (Baja) — Editar, aplicar al grupo y activar una operación aceptan un motivo vacío

- **Requisito**: FR-094 y BE-FR-55 (motivo en toda acción que modifica datos); `contracts/web-routes.md` W41 (exige motivo y
  confirmación).
- **Ficheros**: `apps/operation-settings.ts:38` (`updateOperationSettings`), `apps/activation.ts:25` (`activateOperation`; en
  cambio `deactivateOperation` sí lo exige, línea 67), las acciones `?/guardarOperacion`, `?/aplicarAlGrupo` y `?/activar` de
  `operaciones/[key]/+page.server.ts` (104–109, 178–183 y 221–226). La propuesta R08 da por hecho que «apps, operaciones y
  freno» ya exigen motivo (solo les falta el máximo): estas dos funciones no.
- **Estado**: confirmado por ejecución. Las dos llamadas con motivo vacío terminan sin error y dejan auditoría con motivo `''`.
- **Cambio**: exigir el motivo con `requireReason`. El tope de longitud del motivo queda con R08 y D09 (decisión pendiente ya
  registrada). **Nota documental (W41)**: `contracts/web-routes.md:607` dice que `aplicarAlGrupo` aplica el modelo, y el código
  aplica tiempo máximo, tokens, temperatura y coste máximo (T311); hay que enmendar el contrato (lo hace el propietario).
- **Test (primero, debe fallar)**: `src/lib/server/features/apps/operation-reason.int.test.ts`.

## C-53 (Baja) — Una `pagina` enorme en los filtros GET del panel da 500

- **Requisito**: UX-09 (filtros y paginación en la URL); constitución, validación de entradas (un parámetro inválido se trata, no
  rompe la página).
- **Ficheros**: `admin/usuarios/+page.server.ts:19`, `admin/auditoria/+page.server.ts:30` y `pageNumber` en
  `src/lib/shared/paging.ts:7-9` (`Math.max(1, Number.parseInt(x, 10) || 1)`, sin tope).
- **Estado**: corregido (2026-11-18). `pageNumber` acota a `MAX_PAGE` (10 000) y admite solo enteros seguros; usuarios y auditoría lo usan. Test: tests/http/admin-paginacion-limites.test.ts y `paging.test.ts`. Pasa tras el cambio; no se comprobó en rojo antes del cambio (copiado del repaso y verificado solo después). Antes: confirmado por ejecución (el informe lo daba por sospecha): responde 500. Con «1e400» en cifras da `Infinity` y con
  «100000000000000000000» da 1e20; el desplazamiento llega a SQLite como REAL no representable y lo rechaza en `LIMIT`/`OFFSET`
  («datatype mismatch»).
- **Cambio**: exigir entero seguro y un máximo en `pageNumber`; fuera de rango, la última página o la lista vacía (200) o 400.
- **Test (primero, debe fallar)**: `tests/http/admin-paginacion-limites.test.ts` (500 en lugar de 200 o 400).
