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
| C-54 | Baja     | web      | Protecciones, apps, operación, anuncios, legal y predeterminados no enlazan su auditoría | T445  |
| C-55 | Media    | admin    | El motivo no tiene una longitud máxima común en todas las acciones                       | T446  |
| C-56 | Baja     | settings | La clave `settings.fx_usd_eur` sigue sembrada aunque ya no la lee nadie                  | T447  |
| C-57 | Baja     | apps     | El alta de una operación (W40) tiene campo «motivo», pero nadie lo lee ni lo audita      | T448  |
| C-58 | Baja     | pricing  | El precio orientativo de una operación inexistente responde 500                          | T449  |
| C-59 | Baja     | web      | Ningún test comprueba que `hooks.server.ts` quita la cabecera `x-mm-client-ip`           | T450  |
| C-60 | Media    | settings | Volver a la imagen anterior deja ilegibles los parámetros por las claves sembradas       | T451  |
| C-61 | Baja     | docs     | Los comandos para repetir a mano la 0017 y la 0019 no funcionan tal cual                 | —     |

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
- **Estado**: corregido (2026-11-18). Orden de despliegue y vuelta atrás en `docs/operaciones/migraciones.md` (T399). Vuelta atrás **ensayada en un simulacro local** (2026-11-18, no staging): los pasos 1–3 dejan el `sync_schema` de `secretario` idéntico al de antes de la 0017, el esquema de la imagen anterior al PR #47 (emulado con su `SyncSchema` extraído de git, sin arrancar la imagen) lo rechaza antes y lo acepta después, y el regreso funciona ejecutando el fichero de la 0017 con `exec` (el `prepare` documentado antes fallaba, C-61). En el simulacro aparece C-60: esa misma imagen rechaza las claves de `settings` sembradas después. Sin verificar en staging ni con la imagen anterior arrancada. Antes: confirmado por lectura que la versión anterior (`z.strictObject` sin `personal`) rechaza la clave; el alcance exacto
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
- **Estado**: corregido (2026-11-18), con su test en rojo antes del cambio. La copia fusiona lo copiado con los predeterminados actuales y lanza `NOTHING_SELECTED` si no copia nada (T432). Antes: confirmado por ejecución. Con una selección parcial, los predeterminados quedan solo con las categorías copiadas;
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
- **Estado**: corregido (2026-11-18), con su test en rojo antes del cambio. Motivo obligatorio en W42 y W43 y auditoría con `{ categories, elements, sha256 }` y `after.changed`, sin el JSON (T433). Antes: confirmado por ejecución. Con datos válidos y motivo vacío responde 303 y audita; con motivo, `reason` sigue
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
- **Estado**: corregido (2026-11-18), con su test en rojo antes del cambio. Migración 0019 con los dos triggers; `sync` responde `UNAUTHENTICATED` (T435). La vuelta atrás en staging no está verificada. Antes: la carrera es una sospecha razonable, pero que el servicio no comprueba la cuenta borrada está confirmado por
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
- **Estado**: corregido (2026-11-18), con su test en rojo antes del cambio. La siembra omite las categorías que el esquema vigente no admite y W40 las nombra en un aviso (T437). Antes: confirmado por ejecución. Si el administrador quita o cambia la estrategia de una categoría en W40 después de
  guardar los predeterminados (`apps` no puede revalidar `app_defaults`, que es de `sync`), se siembra un documento que el
  propio servidor rechaza: el cliente que lo devuelve tal cual recibe `VALIDATION_ERROR` en cada PUT.
- **Cambio** (**decisión del propietario**): filtrar la siembra por el esquema vigente, y que W40 avise si el cambio invalida
  los predeterminados.
- **Test (primero, debe fallar)**: `src/lib/server/features/sync/seed-undeclared-categories.int.test.ts` (el documento sembrado
  contiene `retirada` y su reenvío responde `VALIDATION_ERROR`).

## C-46 (Baja) — La limpieza de marcas de borrado carga en memoria todos los documentos

- **Requisito**: rendimiento de `sync` (retención de marcas de borrado).
- **Ficheros**: `sync/service.ts` y `sync/repository.ts` (limpieza de `tombstones`).
- **Estado**: medido (2026-11-18); **sospecha cerrada a la escala prevista**, con un riesgo latente anotado. Sin tarea y sin
  cambios de código. Confirmado por ejecución que `purgeTombstones` carga y analiza todos los documentos de una vez, dentro
  de una transacción `IMMEDIATE`, y que es síncrona: bloquea el bucle de eventos (no se atiende ninguna petición) durante toda
  la limpieza.
- **Medición** (Windows, Ryzen 5 2600X, 48 GB, Node 24.22.2; límite del montón de V8 del proceso: 16 576 MB). Base de
  `pnpm perf:seed <ruta> 20000` (con un simulador mínimo del catálogo), documentos de `secretario` con `customReplacements`
  rellenado hasta el tamaño indicado y, en el 10 % de ellos, tres marcas caducadas; `purgeTombstones` llamada desde un test
  temporal (borrado) con `seedDefaults` y el reloj fijo. «Lectura» es solo `allDocuments` en su transacción `IMMEDIATE`
  (tiempo con el bloqueo de escritura tomado); «RSS máx.» es `process.resourceUsage().maxRSS` al terminar; el proceso parte
  de unos 250 MB.

  | Documentos × tamaño | Datos  | Lectura | Montón retenido | Limpieza completa | Cambiados | RSS máx.  |
  | ------------------- | ------ | ------- | --------------- | ----------------- | --------- | --------- |
  | 5 000 × 10 KB, 0 %  | 47 MB  | 0,26 s  | +99 MB          | 2,0 s             | 0         | 473 MB    |
  | 5 000 × 10 KB       | 47 MB  | 0,23 s  | +99 MB          | 2,0 s             | 500       | 481 MB    |
  | 20 000 × 10 KB      | 188 MB | 1,2 s   | +419 MB         | 7,9 s             | 2 000     | 1 121 MB  |
  | 5 000 × 100 KB      | 483 MB | 2,9 s   | +1 075 MB       | 5,2 s             | 500       | 1 535 MB  |
  | 1 000 × 1 000 KB    | 969 MB | 5,2 s   | +2 160 MB       | 6,8 s             | 100       | 2 688 MB  |
  | 5 000 × 1 000 KB    | 4,8 GB | —       | —               | 34,3 s            | 500       | 11 634 MB |

  Con `--max-old-space-size=2048`, el caso de 1 000 × 1 000 KB **se cae** por falta de memoria
  (`JavaScript heap out of memory`, código 134): en producción la tarea corre dentro del proceso del servidor, que se caería
  con ella. El montón
  retenido es unas 2,2 veces el tamaño de los datos. Con documentos pequeños domina un coste fijo de unos 0,35 ms por
  documento aunque no cambie (5 000 documentos sin marcas caducadas: 2,0 s frente a 0,26 s de la lectura).

- **Conclusión**: a la escala prevista (`plan.md`, «Scale/Scope»: del orden de cientos de cuentas, una sola app), no es un
  problema: cientos de documentos de decenas de KB se limpian en décimas de segundo y con decenas de MB. El riesgo está en el
  peor caso que permite `max_sync_doc_kb` (1 024 KB): la memoria crece con la suma de los documentos, no con su número. 500
  cuentas con el documento al máximo serían unos 0,5 GB de datos, del orden de 1,1 GB de montón y unos 3–4 s de bloqueo
  (extrapolado de la tabla, no medido); 20 000 documentos al máximo no caben en memoria (no medido). Volver a medir si la
  suma de `length(data)` de `sync_documents` pasa de unos 200 MB o si se baja la memoria del contenedor (no medida).
- **Cambio** (propuesto, no hecho; solo si una nueva medición lo justifica): recorrer `sync_documents` por lotes con
  paginación por clave (`(user_id, app_id) > (?, ?) ORDER BY user_id, app_id LIMIT 100`), fuera de la transacción
  `IMMEDIATE` (la escritura ya es condicional por `revision`); filtrar en SQL los que tengan alguna marca anterior al corte
  (`json_each(data, '$.<categoría>.tombstones')` por cada categoría `items` del esquema); leer el esquema una vez por app y no
  por documento; y ceder el bucle de eventos entre lotes. Test: el de `tombstones-cleanup.int.test.ts` más un caso con más
  documentos que el tamaño del lote.
- **Test**: ninguno (no hay cambio).

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
- **Estado**: corregido (2026-11-18), con su test en rojo antes del cambio. `setManualFx` exige un entero entre 500 000 y
  2 000 000 ppm (`VALIDATION_ERROR` en `usdEurPpm`); W38 tiene `?/previsualizarTipoCambioManual` («antes → después») y el
  error junto al campo. Tests: `fx-manual-range.int.test.ts` (6 en rojo) y `tests/http/admin-economia.test.ts` (5 en rojo).
  Antes: confirmado por ejecución. Un valor absurdo (920 en lugar de 920 000) se guarda y cada operación se cobra unas
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
- **Estado**: corregido (2026-11-18), con su test en rojo antes del cambio. El puerto `dailyCosts` devuelve céntimos de euro
  convertidos en `ai` con el `fx_rate_id` de cada operación (sin tipo guardado, el vigente; redondeo hacia arriba), y
  `protections` solo los suma. El test A-03 se adaptó al puerto nuevo y pasó a `src/lib/server/features/ai/brake-fx.int.test.ts`
  (4 en rojo con el código anterior). Antes: confirmado por ejecución. Con un tipo vigente de 2,0 €/USD, 3 USD son 600
  céntimos (por encima de los 500 del freno), pero el freno calcula 276 (a 0,92) y no salta.
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
- **Estado**: corregido (2026-11-18), con su test en rojo antes del cambio, en el alcance acotado: reembolso, cierre de
  sesiones y las cuatro acciones de economía redirigen con `savedRedirect` y W38 muestra el enlace. Test:
  `tests/http/admin-enlace-auditoria.test.ts` (2 en rojo). Siguen sin enlace protecciones, apps, operación, anuncios, legal y
  predeterminados. Antes: confirmado por ejecución. Las dos redirecciones del test no llevan `aviso=saved` ni `auditoria=`.
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
- **Estado**: corregido (2026-11-18), con su test en rojo antes del cambio. `requireReason` en `updateOperationSettings`,
  `activateOperation` y `deactivateOperation`; W41 devuelve `errors.motivo` en el campo de cada formulario. Tests:
  `operation-reason.int.test.ts` (3 en rojo) y `tests/http/admin-operacion.test.ts` (2 en rojo). La nota documental de W41
  ya estaba enmendada en el contrato. Antes: confirmado por ejecución. Las dos llamadas con motivo vacío terminan sin error
  y dejan auditoría con motivo `''`.
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

C-54 a C-56 son decisiones del propietario tras cerrar la fase 23 (2026-11-18): C-54 completa lo que T442 dejó pendiente,
C-55 cierra R08 y D09 de `propuesta-reglas-administracion.md` y C-56 retira la clave que C-49 dejó sin lectores.

## C-54 (Baja) — Protecciones, apps, operación, anuncios, legal y predeterminados no enlazan su auditoría

- **Requisito**: UX-13 (al guardar se enlaza la entrada de auditoría); `contracts/web-routes.md` sección 4
  (`?aviso=saved&auditoria=<entryId>`); BE-FR-55.
- **Ficheros**: las acciones de W39 (`crearApp`), W40, W41, W42, W43, W44, W48 y W49, y los servicios que auditan
  (`apps/service.ts`, `apps/activation.ts`, `apps/operation-settings.ts`, `apps/announcements-admin.ts`, `legal/publish.ts`,
  `sync/service.ts`, `protections/service.ts`, `notifications/mistral-billing.ts`), que devuelven `void`, un id de dominio o
  un booleano en lugar del id de su entrada. Los helpers `savedRedirect` y `savedEntryOf` (`src/lib/server/forms/confirmation.ts`)
  ya existen (T442).
- **Estado**: corregido (2026-11-18), con su test en rojo antes del cambio (15 casos HTTP en rojo por la URL sin `aviso=saved`,
  y la integración de la activación en rojo por devolver `undefined`). Los servicios devuelven el id de la entrada:
  `string` en `updateAppOverrides`, `setAppMaintenance`, `updateAppDetails`, `updateAppVersions`, activar, desactivar,
  `updateOperationSettings`, `updateDefaults`, `applyCopyAsDefaults` y `setMistralBillingError`; `{ id, entryId }` en
  `createApp` y `createOperation`; `{ version, entryId }` en `createTemplateVersion`; `releaseBrake` recibe
  `{ adminId, reason }`, audita el motivo escrito (antes `'manual'`) y devuelve `string | null`; `publishAndNotify` pasa el
  `auditId` de `publishVersion`. Los anuncios ya lo devolvían. Las rutas usan `savedRedirect` (W49 deja de usar
  `?aviso=anuncio_creado`) y las siete páginas muestran el aviso con el enlace (`savedEntryOf`). `aplicarAlGrupo` enlaza la
  entrada de la operación de la ficha. Sin aristas nuevas. Test: `tests/http/admin-enlace-auditoria-{protecciones,apps,operacion,anuncios,legal,predeterminados}.test.ts`
  (con el helper `tests/http/saved-link.ts`, que comprueba la acción de la entrada y el enlace en la página) y
  `apps/activation.int.test.ts` (activar no se puede probar por HTTP: la base no tiene un modelo compatible).
- **Cambio** (**decisión del propietario**): cada servicio auditado devuelve el id de su entrada; las acciones redirigen con
  `savedRedirect` y cada página muestra el aviso con el enlace a la entrada (`savedEntryOf`). Sin aristas nuevas entre
  funcionalidades.
- **Test (primero, debe fallar)**: `tests/http/admin-enlace-auditoria-*.test.ts`, uno por pantalla.

## C-55 (Media) — El motivo no tiene una longitud máxima común en todas las acciones

- **Requisito**: BE-FR-55 y FR-094 (motivo en toda acción que modifica datos); R08 y D09 de `propuesta-reglas-administracion.md`
  (motivo de 1 a 500 caracteres tras recortar, validado por el servicio).
- **Ficheros**: hay cuatro reglas distintas. `accounts/admin-users.ts` (`requireReason` propio, 1–500), `apps/service.ts` y
  `sync/service.ts` (`requireReason` sin máximo), la ruta del ajuste (`MAX_REASON = 500` en la ruta, no en `credits`), y
  comprobaciones sueltas sin máximo en `pricing/service.ts` (tipo manual y precio orientativo), `payments/service.ts`
  (reembolso), `apps/announcements-admin.ts` (desactivar anuncio), `accounts/admin-users.ts` (tester) y las rutas de W44
  (liberar el freno y la alerta de Mistral). `protections.releaseBrake` ni siquiera recibe el motivo: audita `'manual'`.
- **Estado**: corregido (2026-11-18), con su test en rojo antes del cambio (16 casos de unidad, componente e integración y 22
  de la matriz HTTP). Cierra R08 y D09. Regla única en `$lib/shared/reason` (`REASON_MAX_LENGTH`, `reasonIssueOf`);
  `requireReason` en `$lib/server/shared/reason` sustituye a las cuatro reglas y a las comprobaciones sueltas de `accounts`,
  `apps`, `sync`, `pricing`, `payments`, `credits.adjust` (que no validaba), `notifications` (alerta de Mistral) y
  `protections.releaseBrake`; todos auditan el motivo recortado (`setTester`, los cambios de `apps` y el tipo manual
  auditaban el texto sin recortar). En la web, `reasonRejection` (`$lib/server/forms/reason`) responde 400 antes del
  servicio con `errors.motivo`, `values.motivo` y `scope`, y `reasonFieldOf` (`$lib/schemas/common/reason`) pinta el error
  junto al campo de su formulario y conserva lo escrito en W35–W38, W40–W44 y W49. `TextField` admite `maxlength` y todos
  los campos de motivo llevan `maxlength="500"`. Mensaje nuevo `validation_reason_too_long` (sustituye a
  `admin_adjust_reason_too_long`). El reembolso (W37) conserva ahora lo escrito, y la copia de predeterminados (W43) se
  envía a `?vista=propia&/copiar` para volver a pintar el formulario tras un rechazo. `src/lib/server/forms/reason.test.ts`
  se escribió después del cambio (cubre el helper de la ruta).
- **Cambio** (**decisión del propietario**, cierra R08 y D09): una sola regla compartida (`REASON_MAX_LENGTH = 500`) que
  usan todos los servicios con motivo; más de 500 caracteres tras recortar es `VALIDATION_ERROR` con `field: 'reason'`, y en la
  web 400 con el error junto al campo y el texto conservado. Los campos de motivo llevan `maxlength="500"`.
- **Test (primero, debe fallar)**: `src/lib/shared/reason.test.ts`, `src/lib/server/shared/reason.test.ts` y
  `tests/http/admin-motivo-longitud.test.ts`.

## C-56 (Baja) — La clave `settings.fx_usd_eur` sigue sembrada aunque ya no la lee nadie

- **Requisito**: BE-FR-87 (el tipo vigente sale de `fx_rates`; sin filas, el valor por defecto `DEFAULT_FX_USD_EUR_PPM`);
  `data-model.md` 2.5 y H-25.
- **Ficheros**: `apps/defaults.ts` (`DEFAULT_SETTINGS.fx_usd_eur`), `apps/json-schemas.ts` (`SETTING_SCHEMAS.fx_usd_eur`),
  `data-model.md`. Desde C-49 (T440) ni `pricing` ni `protections` leen la clave.
- **Estado**: corregido (2026-11-18), con su test en rojo antes del cambio (`migrations.int.test.ts`: la fila seguía tras
  migrar; `apps/seed.int.test.ts`: 48 parámetros sembrados y la clave resembrada no se borraba). Migración
  `0020_settings_sin_fx_usd_eur` (generada con `drizzle-kit generate --custom`, `DELETE` escrito a mano, idempotente); la
  clave sale de `DEFAULT_SETTINGS` y de `SETTING_SCHEMAS`, y ningún código la lee (búsqueda en `src/`). Como `readSettings`
  rechaza una clave desconocida, el _seed_ borra además las claves retiradas (`RETIRED_SETTING_KEYS`) en cada arranque: una
  vuelta atrás a una imagen anterior la vuelve a sembrar y, al desplegar de nuevo, la 0020 ya consta como aplicada.
  `data-model.md` (2.5, tabla de `settings` y H-25), `quickstart.md` y `docs/operaciones/migraciones.md` (0020: consulta
  previa, vuelta atrás y regreso) enmendados. Vuelta atrás no ensayada en staging.
- **Cambio** (**decisión del propietario**): migración `0020` que borra la fila de `settings`; quitar la clave de los valores
  por defecto y de los esquemas; documentar el orden de despliegue y la vuelta atrás en `docs/operaciones/migraciones.md`.
- **Test (primero, debe fallar)**: `src/lib/server/db/migrations.int.test.ts` (la fila desaparece tras migrar).

C-57 a C-59 son pendientes menores tras cerrar la fase 24 (2026-11-18). C-57 es decisión del propietario (exigir y auditar el
motivo del alta de una operación).

## C-57 (Baja) — El alta de una operación (W40) tiene campo «motivo», pero nadie lo lee ni lo audita

- **Requisito**: BE-FR-55 (motivo de 1 a 500 caracteres en toda acción que modifica datos, con su entrada de auditoría) y
  BE-FR-77 (catálogo de operaciones); `contracts/web-routes.md` W40.
- **Ficheros**: `src/routes/(web)/admin/apps/[slug=appSlug]/+page.server.ts` (`crearOperacion` no lee `motivo`),
  `+page.svelte` (el campo `motivo-operacion` no pinta su error ni conserva lo escrito) y `apps/service.ts` (`createOperation`
  audita `reason: null`).
- **Estado**: corregido (2026-11-18), con su test en rojo antes del cambio: `apps/create-operation-reason.int.test.ts` (5 en
  rojo: sin motivo, en blanco o con 501 caracteres se creaba la operación y la entrada guardaba `reason` nulo) y, contra un
  build con la ruta y el servicio anteriores, 3 casos HTTP en rojo (`admin-motivo-longitud.test.ts`, caso `crearOperacion`, y
  los dos de C-57 en `admin-enlace-auditoria-apps.test.ts`: 303 en lugar de 400 y motivo auditado nulo). `NewOperation` lleva
  `reason` obligatorio; `createOperation` aplica `requireReason` y audita el recortado; W40 rechaza con `reasonRejection`
  (scope `crearOperacion`) y pinta el error con `reasonFieldOf`. Los cuerpos de alta de `admin-enlace-auditoria-operacion` y
  los builders (`chatOperation`, `seededPromptTemplate`) envían motivo. Ningún E2E crea operaciones. `contracts/web-routes.md`
  W40 enmendado. Antes: confirmado por lectura y por ejecución.
- **Cambio** (**decisión del propietario**): la regla común de C-55. La ruta rechaza el motivo con `reasonRejection` (scope
  `crearOperacion`) antes del servicio, la página lo pinta con `reasonFieldOf` (`maxlength="500"` ya estaba) y
  `createOperation` exige `requireReason` y audita el motivo recortado. La redirección con el enlace a la auditoría ya existe
  (C-54, `savedRedirect`).
- **Test (primero, debe fallar)**: integración en `apps/` (sin motivo o con más de 500 caracteres, `VALIDATION_ERROR` en
  `reason` sin crear nada; la entrada guarda el motivo recortado) y HTTP (`tests/http/admin-motivo-longitud.test.ts`, caso
  `crearOperacion`, y el enlace con el motivo auditado).

## C-58 (Baja) — El precio orientativo de una operación inexistente responde 500

- **Requisito**: BE-FR-73 (valor manual del precio orientativo, W38) y BE-FR-55; las demás acciones de administración sobre una
  entidad inexistente responden `NOT_FOUND` (C-50, W41).
- **Ficheros**: `pricing/service.ts` (`setManualPrice` inserta en `price_references` sin comprobar la operación; la clave
  foránea a `app_operations` lo rechaza dentro de la transacción) y `admin/economia/+page.server.ts`
  (`guardarPrecioOrientativo`).
- **Estado**: corregido (2026-11-18), con su test en rojo antes del cambio. Confirmado por ejecución: con un motivo válido,
  `setManualPrice` lanzaba `SqliteError` `SQLITE_CONSTRAINT_FOREIGNKEY` (integración) y la web respondía 500 (HTTP).
  `setManualPrice` comprueba la operación dentro de la transacción con `operationKeysOf` (API pública de `apps`, sin aristas
  nuevas) y lanza `NOT_FOUND` en `operation`; la ruta responde 404 con `failureOf` y el aviso genérico de W38. Tests:
  `pricing/manual-price.int.test.ts` y `tests/http/admin-economia.test.ts` (C-58). `contracts/web-routes.md` W38 enmendado.
- **Cambio**: si se confirma, `setManualPrice` lanza `NOT_FOUND` con `field: 'operation'` sin escribir ni auditar, comprobando
  la operación con la API pública de `apps` (sin aristas nuevas: `pricing` ya importa `apps`); la web responde 404 con
  `failureOf`.
- **Test (primero, debe fallar)**: integración en `pricing/manual-price.int.test.ts` y HTTP en
  `tests/http/admin-economia.test.ts` (operación inexistente con un motivo válido).

## C-59 (Baja) — Ningún test comprueba que `hooks.server.ts` quita la cabecera `x-mm-client-ip`

- **Requisito**: constitución, «Fuente única de la IP del cliente» (`event.getClientAddress()`); BE-FR-04 (la sesión guarda la
  IP) y BE-FR-45 (límites por IP). Completa C-35 (T427), que quitó la cabecera sin test propio.
- **Ficheros**: `src/hooks.server.ts` (`stripInternalHeaders`); tests en `tests/http/` y `src/hooks.server.test.ts`.
- **Estado**: corregido (2026-11-18), solo tests. Con el paso desactivado temporalmente (restaurado después, sin cambios en
  `hooks.server.ts`): `src/hooks.server.test.ts` falla (2 en rojo: la sesión y la ruta reciben `203.0.113.9`), y
  `tests/http/client-ip-header.test.ts` **sigue pasando**, porque ninguna llamada a Better Auth que crea una sesión recibe las
  cabeceras de la petición (`headersFor` y `authHeadersOf` las construyen con la IP real): el paso es una defensa en
  profundidad que no se observa por HTTP. El test HTTP queda como comprobación del extremo a extremo (login de la web y de la
  API con `x-mm-client-ip`: la sesión guarda la IP de `X-Forwarded-For`), y el del `handle` es el que vigila el paso.
- **Cambio**: solo tests. Una petición con `x-mm-client-ip: 203.0.113.9` no fija la IP de la sesión (HTTP, contra el build) y
  ningún paso posterior ni la sesión ven la cabecera. Se comprueba que el test falla si se desactiva el paso.
- **Test**: `tests/http/client-ip-header.test.ts` y `src/hooks.server.test.ts`.

C-60 y C-61 proceden del simulacro local de las migraciones 0017–0020 (2026-11-18, bases SQLite temporales, no staging;
procedimiento y resultados en `docs/operaciones/migraciones.md`).

## C-60 (Media) — Volver a la imagen anterior deja ilegibles los parámetros por las claves sembradas

- **Requisito**: constitución, «Datos y almacenamiento» (migraciones compatibles con la vuelta atrás); BE-FR-61 (parámetros
  globales).
- **Ficheros**: `src/lib/server/features/apps/repository.ts` (`readSettings`: `if (!isSettingKey(row.key)) throw corruptError`,
  igual en todas las versiones), `apps/seed.ts` y `apps/defaults.ts` (el _seed_ inserta en cada arranque las claves que
  falten), `apps/json-schemas.ts` (`SETTING_SCHEMAS`), `docs/operaciones/migraciones.md`.
- **Estado**: corregido (2026-11-18), con su test en rojo antes del cambio (`apps/settings-unknown-key.int.test.ts`: 2 de 4
  en rojo, los dos de la clave desconocida, por `INTERNAL_ERROR` de `readSettings`; los otros dos, que el panel no acepta
  guardar la clave y que una clave conocida con un valor no válido sigue siendo corrupción, pasaban ya y quedan de guarda).
  Decisión del propietario: opción (b). `readSettings` omite la clave desconocida sin tocar la fila y emite
  `apps.settings.unknown_key` (`warn`, solo `key`) una vez por clave y conexión (`firstUnknownSettingWarning`, en
  `config.cache.ts`); una clave conocida con valor no válido sigue lanzando `config_corrupt`. `RETIRED_SETTING_KEYS` y
  `seedDeleteSettings` se mantienen: retirada = el _seed_ la borra al arrancar; desconocida = se tolera y se avisa. No arregla
  la imagen de `staging` del 2026-11-17 ni las anteriores: para volver a ellas sigue haciendo falta el paso manual de
  `docs/operaciones/migraciones.md`. No ensayado en staging. Antes: confirmado por ejecución (emulado). Tras migrar y
  sembrar con la imagen actual, la base tiene
  `signup_attempts_per_ip_hour`, `resend_verification_per_email_hour` y `password_reset_per_email_hour` (C-34 y C-36, T426 y
  T428, commit `bd66f2e`, sin migración: las siembra el _seed_). Los esquemas de `settings` de `origin/staging` (imagen del
  PR #48, 2026-11-17) y de la anterior al PR #47, extraídos de git, rechazan esas tres claves; `readSettings` de esas imágenes
  lanza con una clave desconocida (mismo código). No se ha arrancado la imagen anterior, así que el alcance exacto de la caída
  (qué rutas fallan y si `GET /api/v1/health` lo detecta) no está comprobado. Documentado el paso manual previo en
  `docs/operaciones/migraciones.md` («Claves nuevas de `settings` y vuelta a una imagen anterior (C-60)»), verificado en el
  simulacro: tras borrar las tres claves, las 45 filas son válidas para la imagen de staging, y al volver el _seed_ las inserta
  con sus valores por defecto. Las secciones 0018–0020 decían «compatible sin cambios» sin contar con esto; corregidas.
- **Qué pasa**: la vuelta atrás de la imagen siguiente a la de staging actual (la que lleva 0017–0020) a la de staging deja
  la base con tres claves que la imagen de staging no conoce: fallan todas las lecturas de parámetros globales. Es el mismo
  defecto que obligó a la 0020, en sentido contrario, y se repetirá con cada clave nueva de `settings`.
- **Cambio** (**decisión del propietario**): (a) solo operación: mantener el paso manual documentado y añadir a la lista de
  comprobación de cada despliegue las claves nuevas de `settings`; o (b) código, para las vueltas atrás futuras: que
  `readSettings` omita una clave desconocida con su evento (`apps.settings.unknown_key` o similar, sin el valor) en lugar de
  lanzar, de modo que una imagen anterior tolere las claves de una posterior (no arregla la imagen de staging actual, que
  sigue necesitando el paso manual). Con (b), la 0020 y `RETIRED_SETTING_KEYS` dejarían de ser imprescindibles, aunque siguen
  siendo útiles para no dejar filas huérfanas.
- **Test (primero, debe fallar)**, solo con (b): en `apps/`, una fila de `settings` con una clave desconocida no impide leer
  los parámetros (`getEffectiveConfig` devuelve los valores) y emite el evento sin el valor. Hecho en
  `apps/settings-unknown-key.int.test.ts` (también: un solo aviso por clave aunque se vuelva a leer de la BD, el panel sigue
  rechazando la clave y una clave conocida inválida sigue lanzando).
- **Verificación**: `pnpm test:related` del test; en staging, la vuelta atrás con el paso manual (no ensayada).

## C-61 (Baja) — Los comandos para repetir a mano la 0017 y la 0019 no funcionan tal cual

- **Requisito**: constitución, «Datos y almacenamiento» (procedimiento de vuelta atrás probado).
- **Ficheros**: `docs/operaciones/migraciones.md` («Cómo ejecutar una consulta en el contenedor», 0017 y 0019).
- **Estado**: corregido en la documentación (2026-11-18), confirmado por ejecución en el simulacro local. Con el comando
  documentado (`db.prepare(process.argv[1])`): el texto de `drizzle/0017_….sql` y `drizzle/0019_….sql` empieza por `--` y
  `node` lo toma como opción (`bad option`, código 9); el `DROP TRIGGER` de la 0019 con dos sentencias falla con `The supplied
SQL string contains more than one statement`, igual que el fichero de la 0019. Documentado un comando con `exec` que lee el
  fichero, y los dos `DROP TRIGGER` por separado; los dos comandos se han ejecutado en el simulacro (Windows), no en el
  contenedor. Se añade además que, tras recrear los _triggers_, hay que repetir la consulta previa de la 0019.
- **Cambio**: solo documentación (hecho).
- **Test**: ninguno.
