# Propuesta de reglas de negocio del panel de administración

- Estado: propuesta para revisión. No aprobada. No cambia código, `tasks.md`, ADR ni `Historias.md`.
- Fecha: 2026-10-27. Rama: `001-cuenta-mardomingo-v4`.
- Ámbito: notas de T307, T308, T310, T312, T313 y T321 (`tasks.md`, líneas 593–607).
- Fuentes: `spec.md` (FR-xxx, US y aclaraciones), `Historias.md` (BE-FR-xx, sección 9 y 5.x), `contracts/web-routes.md` (W36–W44), `pendientes-noche.md` y el código de `src/routes/(web)/admin/**` y de los servicios que llaman (`src/lib/server/features/*`, `src/lib/server/web/*`).
- Cómo leer cada regla: **Hoy** es lo que hace el código (`fichero:línea`). **Spec** es lo que dice la especificación (con referencia). **Riesgo** es el efecto concreto si se queda así. **Propuesta** es la recomendación. **Alternativa** es otra opción razonable y cuándo elegirla. **Cambios** es la lista corta de ficheros.
- Las referencias a `spec.md` y `Historias.md` son números de línea de la versión actual del repositorio.

Nada de esto se ha ejecutado: no se han corrido tests ni Playwright. Las afirmaciones sobre comportamiento son lecturas del código. Donde algo es una deducción y no está reproducido, se dice.

## 1. Resumen

- Reglas revisadas: **17** (R01–R17).
- De ellas, **8** contradicen algo que la especificación ya fija (el código no hace lo que dice la spec): R01, R05, R08, R09, R10, R12, R13 y R16.
- Las **9** restantes son reglas que la especificación no fija o las deja ambiguas: R02, R03, R04, R06, R07, R11, R14, R15 y R17. R05 combina una contradicción (zona horaria) con una regla no fijada (horizonte).
- Dos hallazgos no son decisiones de negocio y conviene corregirlos aunque no se aprueben las demás propuestas: **R12** (un reembolso parcial reenviado puede aplicarse dos veces y la retirada de saldo y el cambio de estado no van en la misma transacción) y **R06** (la vista previa de una resta no comprueba el tipo de bolsa y promete un resultado que luego no se cumple).

## 2. Qué ya fija la especificación (no necesita decisión)

Varias notas de `tasks.md` piden decidir cosas que la spec ya fija. Se listan para que no se reabran.

| Tema                                                                                                                        | Dónde lo fija la spec                                                                                                      | Estado en el código                                                                                                         |
| --------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| Un ajuste positivo liquida primero la deuda (movimiento `debt_settlement`), gratuito o comprado                             | BE-FR-17 (`Historias.md:320`), FR-029 (`spec.md:332`), US7 esc. 7 (`spec.md:88`), aclaración `spec.md:17`                  | Cumple. `credits/service.ts:347-375` y `web/balance-adjustment.ts:33`                                                       |
| Una resta no supera el saldo disponible y el ajuste nunca crea deuda                                                        | FR-029 (`spec.md:332`), aclaración `spec.md:22`                                                                            | Cumple para el total disponible. El límite por tipo de bolsa es otra cuestión: ver R06                                      |
| Motivo obligatorio en ajuste, reembolso, bloqueo y cierre de sesiones; vista previa antes → después y enlace a la auditoría | UX-13, FR-127 (`spec.md:463`), `spec.md:163`                                                                               | Cumple en ajuste y reembolso (`ajuste/+page.server.ts`, `reembolso/+page.server.ts`)                                        |
| Cambios de parámetros económicos y de protecciones: valor anterior, nuevo y alcance antes de guardar                        | UX-14, FR-128 (`spec.md:464`)                                                                                              | Hay vista previa en protecciones (`previsualizarLimites`) y en economía (`previewSettingChange`, `apps/setting-preview.ts`) |
| Límite por cuenta (suma de apps) y límite por app no mayor que el global; se aplica el que se alcance antes                 | Aclaración `spec.md:18`, FR-004 (`spec.md:298`), BE-FR-63 CA4 (`Historias.md:191`)                                         | Parcial: ver R01                                                                                                            |
| Cambiar una predeterminada no modifica ninguna cuenta                                                                       | BE-FR-42 CA1 (`Historias.md:593`), US6 esc. 4                                                                              | Cumple: `sync/service.ts:180-207` solo escribe el documento de predeterminados                                              |
| Cortes diarios y caducidades en Europe/Madrid                                                                               | `Historias.md:155`, `spec.md:283`                                                                                          | No cumple en la caducidad del ajuste: ver R05                                                                               |
| Escrituras que afectan a saldo o reembolsos, atómicas                                                                       | FR-030 (`spec.md:333`)                                                                                                     | No cumple en el reembolso: ver R12                                                                                          |
| Auditoría con fecha, acción, entidad, valores anterior y nuevo y motivo, inmutable                                          | FR-094 (`spec.md:421`), BE-FR-55 (`Historias.md:652`)                                                                      | Parcial: ver R08, R09, R16                                                                                                  |
| Freno global: se libera a mano o al día siguiente                                                                           | BE-FR-46 (`Historias.md:610-612`), FR-072 (`spec.md:393`)                                                                  | Parcial: ver R16                                                                                                            |
| Reembolso: retirar el saldo no consumido que indique el administrador; el importe en euros solo con proveedor real          | BE-FR-27 (`Historias.md:432`), FR-043 (`spec.md:352`), US6 esc. 7 (`spec.md:108`), W37 (`contracts/web-routes.md:558-560`) | No cumple: ver R10 y R11                                                                                                    |
| Mantenimiento con mensaje personalizable                                                                                    | BE-FR-47 (`Historias.md:614`)                                                                                              | Cumple: `apps/service.ts:431` exige mensaje al activar                                                                      |
| Alta de app con `SLUG_TAKEN` (409)                                                                                          | W39 (`contracts/web-routes.md:578-579`)                                                                                    | Cumple en el caso normal. Ver R15 para la carrera y el formato                                                              |

Nota sobre las notas de `tasks.md`: el «orden de liquidación de deuda» de T307 ya está fijado (BE-FR-17). No hay decisión que tomar ahí. Los «límites por app» de T310/T313 sí están fijados en su principio (no mayor que el global); lo que falta decidir es qué claves tienen ese tope (R01).

## 3. Reglas

### R01. Techo de las sobrescrituras por app frente al global

1. **Hoy.** Solo se comparan dos claves con su global: `ai_requests_per_minute` y `max_concurrent_transcriptions` (`apps/json-schemas.ts:40-43`, `apps/config.ts:74-86`). Al subir un global se comprueba lo mismo (`apps/service.ts:94-98`, `:336-346`). `max_text_chars` y `max_image_mb` tienen global y su sobrescritura se resuelve sin tope (`apps/config.ts:55-63`). Un admin puede fijar `max_text_chars` de una app por encima del global sin que el sistema proteste. Bajar el global de `max_text_chars` no comprueba ni avisa de las sobrescrituras existentes.
2. **Spec.** Fija el principio: «el valor por app, si existe, es un límite adicional ... no mayor que el global» (`spec.md:18`); FR-004 (`spec.md:298`) suma los topes por cuenta entre apps. Historias §9 marca `max_text_chars` y `max_image_mb` como «Global / por app / por operación» (`Historias.md:1078-1079`). **No fija** qué claves llevan tope. Las claves «Por app» sin global (`max_audio_seconds`, `audio_duration_tolerance_seconds`, `max_audio_mb`, `max_sync_doc_kb`, `Historias.md:1075-1080`) no tienen techo definido.
3. **Riesgo.** Por un lado, el global deja de ser un límite real para esa app. El coste queda acotado por `max_cost_credits` de cada operación (BE-FR-72), así que el daño es acotado, pero la intención de la regla no se cumple. Por otro, un global bajado sin revisar las apps puede dejar sobrescrituras que lo superan. Es un riesgo de configuración, no de corrupción de datos.
4. **Propuesta.** Aplicar el techo a las cuatro claves que tienen global (`ai_requests_per_minute`, `max_concurrent_transcriptions`, `max_text_chars`, `max_image_mb`), tanto en `updateAppOverrides` como en `updateSetting`. Mensaje de error con app y clave, por ejemplo: «El límite de `max_text_chars` de la app X (300 000) supera el global (200 000)». Las cuatro claves sin global no tienen techo hasta que se decida (ver D06).
5. **Alternativa.** En lugar de rechazar, tomar el mínimo entre sobrescritura y global al resolver (`resolveAppSettings`, `apps/config.ts:36-52`) y mostrar en el panel el valor efectivo con su origen (BE-FR-61 CA5). Elegir esta opción si no se quiere bloquear guardados en la ficha de una app.
6. **Cambios.** `apps/json-schemas.ts` (`OVERRIDABLE_CEILINGS`), `apps/config.ts` (`overrideCeilingIssues`), `apps/service.ts` (`isCeilingKey`, `updateSetting`, `updateAppOverrides`), `routes/(web)/admin/apps/[slug=appSlug]/+page.server.ts` (mensaje). Tests: `apps/apps.int.test.ts`, test unitario de `apps/config.ts`, `tests/http/admin-apps.test.ts`.

### R02. Bajar un global por debajo de una sobrescritura existente

1. **Hoy.** `updateSetting` lanza `VALIDATION_ERROR` sobre el campo `value` y no dice qué app ni qué valor lo impide (`apps/service.ts:336-346`). La ruta lo muestra como fallo genérico (`routes/(web)/admin/protecciones/+page.server.ts:107-110`).
2. **Spec.** No dice nada sobre este caso.
3. **Riesgo.** Sin riesgo de dinero ni de datos. Riesgo de UX: en un incidente (por ejemplo, abuso que obliga a bajar `ai_requests_per_minute` ya) el admin no sabe qué hay que cambiar antes y no puede actuar rápido.
4. **Propuesta.** Mantener el rechazo (no se cambia nada sin una acción explícita) y listar en el mensaje cada app y su valor que impide el cambio. No se añade ninguna acción nueva.
5. **Alternativa.** Recortar automáticamente las sobrescrituras que superan el nuevo global, en la misma transacción, con una entrada de auditoría por cada una. Elegirla si en incidentes el tiempo de reacción pesa más que el control (ver D07).
6. **Cambios.** `apps/service.ts` (listar conflictos), mensajes del panel, `apps/apps.int.test.ts`, `tests/http/admin-protecciones.test.ts`.

### R03. Rangos de los parámetros de protección

1. **Hoy.** Los nueve límites de W44 (`routes/(web)/admin/protecciones/+page.server.ts:17-27`) son enteros positivos sin máximo (`PositiveInt`, `apps/json-schemas.ts:7`, `:107-118`). El freno global es `EurCents = NonNegativeInt` (`apps/json-schemas.ts:84`, `:125`), así que **0 es válido**.
2. **Spec.** BE-FR-61 CA2 exige validar «tipos, rangos y coherencias» y cita solo dos ejemplos: margen ≥ 1 y `min_balance_to_operate` ≥ 0 (`Historias.md:1035`). No fija rangos de protecciones ni dice nada del freno en 0.
3. **Riesgo.** Un freno en 0 bloquea con `SERVICE_LIMITED` a todas las cuentas sin compras en su siguiente operación con coste positivo. Es un corte de servicio masivo. `login_max_failures` = 1 000 000 desactiva en la práctica el bloqueo por fuerza bruta (seguridad). Sin máximos, un error de tecleo (3000 por 30) pasa sin aviso.
4. **Propuesta.** Rangos iniciales para validar por el propietario:

   | Clave                                         | Mínimo    | Máximo         |
   | --------------------------------------------- | --------- | -------------- |
   | `global_daily_free_cost_brake_eur` (céntimos) | 100 (1 €) | 10 000 (100 €) |
   | `registrations_per_ip_24h`                    | 1         | 20             |
   | `login_max_failures`                          | 3         | 50             |
   | `login_lock_minutes`                          | 1         | 1 440          |
   | `login_per_ip_15min`                          | 5         | 500            |
   | `resend_verification_per_ip_hour`             | 1         | 50             |
   | `password_reset_per_ip_hour`                  | 1         | 50             |
   | `ai_requests_per_minute`                      | 1         | 300            |
   | `max_concurrent_transcriptions`               | 1         | 10             |

   Los valores son una sugerencia mía, no datos de la spec. Los defaults de `Historias.md` §9 (freno 5 €, 3 altas por IP, 10 fallos de login, 30 peticiones por minuto, 2 transcripciones) caen dentro de estos rangos.

5. **Alternativa.** Solo elevar el mínimo a 1 y no poner máximo. Elegirla si el propietario prefiere menos fricción y acepta el riesgo de error de tecleo (D08).
6. **Cambios.** `apps/json-schemas.ts` (sustituir `PositiveInt`/`EurCents` por rangos en esas claves). Tests: `apps/apps.int.test.ts`, `tests/http/admin-protecciones.test.ts`.

### R04. Tope de importe de un ajuste de saldo

1. **Hoy.** El campo `cantidad` solo exige entero positivo (`routes/(web)/admin/usuarios/[userId]/ajuste/+page.server.ts:49-50`). No hay máximo. Se convierte con `toMicro(credits * 1_000_000)` (línea 65). Con 1 € = 1 000 créditos (`Historias.md:1212`), 1 000 000 créditos son 1 000 €. La vista previa muestra solo créditos, no euros.
2. **Spec.** No dice nada sobre importe máximo. Fija el motivo, el tipo de bolsa, la caducidad (si es gratuita) y el límite de las restas (FR-029, `spec.md:332`).
3. **Riesgo.** Dinero. Un ajuste gratuito grande con un error de tecleo es coste potencial que asume la plataforma cuando el usuario lo consume. Con la vista previa en créditos, el admin no ve el orden de magnitud en euros.
4. **Propuesta.** (a) Añadir a la vista previa el equivalente en euros (créditos ÷ `credits_per_eur_purchase`). (b) Tope por ajuste de **100 000 créditos (100 €)**; por encima, rechazo con mensaje «Un ajuste admite como máximo 100 000 créditos; haz varios ajustes, cada uno con su motivo».
5. **Alternativa.** Sin tope, pero con confirmación reforzada (volver a escribir el importe) para ajustes de más de 10 000 créditos. Elegirla si el admin necesita ajustes grandes sin fricción (D04).
6. **Cambios.** `ajuste/+page.server.ts` (`parse`, vista previa), `web/balance-adjustment.ts` (nuevo motivo de rechazo), `ajuste/+page.svelte`. Tests: `web/balance-adjustment.test.ts`, `web/balance-adjustment.int.test.ts`, `tests/http/admin-balance-adjustment.test.ts`.

### R05. Caducidad de la bolsa gratuita del ajuste: zona horaria y horizonte

1. **Hoy.** La fecha `vence` se convierte a **fin de día UTC** (`ajuste/+page.server.ts:58`: `T23:59:59Z`). Solo se exige que sea futura (línea 59). No hay horizonte máximo.
2. **Spec.** Los cortes diarios y las caducidades usan Europe/Madrid (`Historias.md:155`, `spec.md:283`). Eso contradice el código. **No fija** un horizonte máximo para la caducidad de un ajuste. El ajuste puede fijar su propia caducidad (`spec.md:326`), sin límite.
3. **Riesgo.** Zona: una bolsa con «vence el 15» caduca a las 01:59 del 16 en Madrid durante el horario de verano. El aviso de caducidad (`free_expiry_warning_days`) sale con otro día. Es un fallo menor, pero visible. Horizonte: un ajuste gratuito con fecha en 2099 no caduca nunca en la práctica. Es pasivo sin límite.
4. **Propuesta.** Fin de día en Europe/Madrid, con el mismo criterio que el corte diario del freno. Horizonte máximo de **365 días** desde hoy. No he verificado si ya existe un helper de fin de día Madrid en `src/lib/shared/time.ts` o en `credits`; hay que comprobarlo antes de escribir uno nuevo.
5. **Alternativa.** Para el horizonte, 90 días si el propietario quiere ajustes gratuitos más cortos (D13). Para la zona no hay alternativa razonable: la spec la fija.
6. **Cambios.** `ajuste/+page.server.ts` (`parse`), helper de fecha compartido (si procede). Tests: `credits.int.test.ts`, `tests/http/admin-balance-adjustment.test.ts`.

### R06. Resta por tipo de bolsa: límite y vista previa

1. **Hoy.** La vista previa comprueba solo el disponible total (`web/balance-adjustment.ts:25`). El servicio exige además que la resta quepa en las bolsas **del tipo elegido** (`credits/domain/ledger.ts:254-263`, `kindTotal`). Resultado: la vista previa dice «correcto», y al aplicar falla con `exceeds_available`, que la ruta traduce a «validation_invalid» en `amountCredits` (`ajuste/+page.server.ts:149-153`). El mensaje dice «supera el disponible» cuando lo que falla es el tipo. Además, `getBalance` no expone el disponible por tipo (`credits/index.ts`), así que la vista previa no puede calcularlo hoy.
2. **Spec.** FR-029 (`spec.md:332`) y BE-FR-18 dicen que una resta no supera el saldo **disponible**. No dicen si la resta se limita al tipo de bolsa elegido ni en qué orden se consume. Quedan ambiguos los dos puntos.
3. **Riesgo.** Dinero y UX. Quitar créditos comprados con el tipo «gratuito» (o al revés) se rechaza sin explicación. Además, retirar créditos **comprados** por ajuste no genera devolución, factura rectificativa ni movimiento de reembolso: queda solo en auditoría. Eso no es un fallo técnico, pero el propietario debe saberlo (no está fijado en la spec).
4. **Propuesta.** Opción A (la que hace el servicio hoy, hecha visible): limitar la resta al tipo elegido, exponer en `credits` el disponible por tipo, mostrarlo en la vista previa («la bolsa gratuita tiene X») y devolver un error propio (`exceeds_kind`). Recomiendo A por trazabilidad: el admin elige el tipo y el sistema lo respeta.
5. **Alternativa.** Opción B: restar en orden de consumo (gratuitas que caducan antes) sin tener en cuenta el tipo, que solo se usa para sumar. Elegirla si el admin necesita quitar saldo sin pensar en el tipo (D05).
6. **Cambios.** `credits/index.ts` (exponer disponible por tipo, a través del `index.ts`), `web/balance-adjustment.ts` (nuevo input y motivo), `ajuste/+page.server.ts` (pasar el dato, mapear `exceeds_kind`), `ajuste/+page.svelte`. Tests: `web/balance-adjustment.test.ts`, `credits.int.test.ts`, E2E del ajuste.

### R07. Ajuste de saldo sobre una cuenta bloqueada o con contracargo

1. **Hoy.** La carga rechaza cuentas borradas con 404 (`ajuste/+page.server.ts:76`). No comprueba si la cuenta está bloqueada. `adminOrThrow` comprueba solo el rol del admin (línea 19-27). Un ajuste positivo o negativo se aplica sobre una cuenta bloqueada.
2. **Spec.** Un contracargo bloquea la cuenta «hasta revisión del administrador» (BE-FR-28, `Historias.md:434`; FR-044, `spec.md:353`). El bloqueo revoca sesiones (FR-088, `spec.md:415`). **No dice** si se puede ajustar el saldo de una cuenta bloqueada.
3. **Riesgo.** Dinero. Con un contracargo abierto, el admin puede sumar créditos gratuitos o restar saldo sin que el bloqueo lo impida. La auditoría lo registra, pero la regla de negocio de «bloqueada» no se aplica al saldo.
4. **Propuesta.** En cuentas bloqueadas, rechazar las **sumas** (gratuitas o compradas) con mensaje «Desbloquea la cuenta antes de sumar saldo». Permitir las **restas**, que sirven para corregir. Revisar en la ficha antes de desbloquear.
5. **Alternativa.** Ninguna restricción: el admin decide y la auditoría queda. Elegirla si el admin necesita reparar saldos sin desbloquear (D12).
6. **Cambios.** `ajuste/+page.server.ts` (carga y acciones), `web/balance-adjustment.ts` o precomprobación. El estado de bloqueo se lee a través de `accounts/index.ts`. Tests: `admin-actions.int.test.ts`, `tests/http/admin-balance-adjustment.test.ts`.

### R08. Motivo obligatorio y su longitud, en todas las acciones que escriben

1. **Hoy.** Hay cuatro situaciones:
   - Ajuste, reembolso y cuentas: motivo de 1 a 500 (`ajuste/+page.server.ts:16`, `:54`; `accounts/admin-users.ts:99-105`).
   - Apps, operaciones y freno: sin máximo (`apps/service.ts:295-297`).
   - Alta de app sin motivo: `apps/service.ts:681` registra `reason: null`, y el formulario de alta no tiene campo (`routes/(web)/admin/apps/+page.server.ts:49-54`).
   - Sin motivo: desactivar anuncios y desactivar operaciones (T321, `tasks.md:607`); marcar o desmarcar tester (T321 lo excluye porque BE-FR-50 no lo exige).
2. **Spec.** FR-094 (`spec.md:421`) exige motivo en toda acción que modifique datos y enumera apps, operaciones, anuncios, predeterminados, legales, reembolsos y tipo de cambio manual. BE-FR-55 (`Historias.md:652`) lo repite. BE-FR-50 no pide motivo para tester, pero FR-094 es general. El límite de 1 a 500 caracteres **no** está en la spec: viene de T307.
3. **Riesgo.** Auditoría incompleta. El panel no responde «por qué» para cambios de apps, anuncios u operaciones, y eso incumple FR-094. Sin máximo en apps, un motivo de tamaño arbitrario entra en la auditoría.
4. **Propuesta.** Motivo obligatorio, de 1 a 500 caracteres tras recortar, en **todas** las acciones que escriben, incluidas tester, desactivar anuncio y desactivar operación (ver D09). El servicio lo valida, no solo la ruta. Un componente de motivo común en el panel.
5. **Alternativa.** Motivo obligatorio solo en las acciones de dinero, cuenta y configuración; catálogo y tester sin motivo. Eso exige enmendar FR-094 con `/speckit-clarify`. Elegirla si la carga para el único administrador es excesiva.
6. **Cambios.** `apps/service.ts` (`requireReason` con máximo; motivo en `createApp`), `apps/activation.ts` (desactivar operación), `notifications/service.ts` (desactivar anuncio), `accounts` (tester), formularios de alta de app, anuncios, operaciones y usuario. Tests: `tests/http/admin-motivo.test.ts` (ampliar la matriz), `apps/apps.int.test.ts`.

### R09. Auditoría con valores anterior y nuevo (predeterminados, copia, alta)

1. **Hoy.** `updateDefaults` registra `before: null` y `after: null`, con motivo fijo «Actualización de predeterminados» (`sync/service.ts:192-202`). La copia hace lo mismo con el motivo fijo «Copia de datos propios como predeterminados» (`sync/service.ts:241-252`). La alta de app registra `reason: null` (R08).
2. **Spec.** FR-094 (`spec.md:421`) y BE-FR-55 (`Historias.md:652`) exigen valor anterior y valor nuevo.
3. **Riesgo.** Un predeterminado malo (prompt roto, sustitución incorrecta) no puede revertirse desde la auditoría, porque no guarda lo que había antes. Tampoco se sabe qué cambió. Es un incumplimiento directo de FR-094.
4. **Propuesta.** Guardar en `before` y `after` el documento completo de predeterminados. Es restaurable, y el tamaño está acotado por `max_sync_doc_kb` (1 024 KB por defecto, `Historias.md:587`). La auditoría es solo de inserción y la spec no fija política de retención: el crecimiento debe aceptarse de forma explícita por el propietario antes de implementarlo.
5. **Alternativa.** Resumen por categoría (número de elementos, bytes y hash SHA-256 del contenido) en `before` y `after`. No permite restaurar. Elegirla si el crecimiento de la auditoría preocupa más que poder revertir.
6. **Cambios.** `sync/service.ts` (`updateDefaults`, `applyCopyAsDefaults`), `routes/(web)/admin/apps/[slug=appSlug]/predeterminados/+page.server.ts` y `.svelte` (campo de motivo), `sync/sync.int.test.ts`, `tests/http/admin-predeterminados.test.ts`.

### R10. Reembolso: créditos a retirar (cómo se calculan)

1. **Hoy.** El admin introduce solo el importe en euros (`reembolso/+page.server.ts:61-62`, `:85-86`). Los créditos se calculan proporcionales al importe, redondeando hacia abajo (`payments/service.ts:258-261`). `refundPreview` no comprueba el saldo restante de la bolsa (`payments/service.ts:267-277`). La comprobación real está en `credits.withdrawForRefund` (`credits/service.ts:641-654`), y devuelve el mismo `PAYMENT_NOT_REFUNDABLE` para todos los casos. La comprobación de `planRefund` compara con `row.creditsMicro`, que son los créditos **originales** de la compra y no el restante (`payments/service.ts:301`; `payments/domain/refund.ts:28`), así que no protege nada.
2. **Spec.** BE-FR-27 (`Historias.md:432`) y US6 esc. 7 (`spec.md:108`) dicen que el administrador **indica el saldo no consumido a retirar**. W37 (`contracts/web-routes.md:558-559`) define `creditsToRemove` (≤ no consumido) y `amountEur` aparte. Desviación: el código no tiene el campo `creditsToRemove`.
3. **Riesgo.** Dinero y trazabilidad. Con una compra parcialmente consumida, la parte proporcional puede superar lo que queda y el reembolso falla con un 409 genérico. El admin no puede retirar «lo que quede», que es lo que la spec describe.
4. **Propuesta.** Seguir la spec: el admin escribe `creditsToRemove` (formato decimal español, ≤ saldo restante de la bolsa de esa compra). La vista previa muestra el restante, los créditos a retirar, el importe (solo si el proveedor es real) y el efecto antes → después (UX-13). La validación compara con el restante real antes de escribir, y el error indica el restante.
5. **Alternativa.** Mantener el cálculo proporcional y enmendar la spec (BE-FR-27, US6 esc. 7 y W37) con `/speckit-clarify`. En ese caso, la vista previa debe mostrar el restante y el error debe decir «la compra solo tiene X créditos sin consumir» (D01).
6. **Cambios.** `reembolso/+page.server.ts` y `.svelte`, `payments/service.ts` (`refundPreview`, `refund`), `payments/domain/refund.ts`, `credits/index.ts` (leer el restante de la bolsa de la compra, a través del `index.ts`). Tests: `payments/refund-chargeback.int.test.ts`, `tests/http/admin-refund.test.ts`, E2E de reembolso.

### R11. Reembolso: importe en euros solo con proveedor real

1. **Hoy.** El importe es obligatorio también en compras simuladas (`reembolso/+page.server.ts:85-86`). `payments.refund` escribe `refundedEurCents` y el estado `refunded` aunque no haya devolución (`payments/service.ts:324-340`). La factura no se toca en simuladas (`invoicing/service.ts:174-177`), pero la compra queda con un importe devuelto que nunca se devolvió.
2. **Spec.** FR-043 (`spec.md:352`) y BE-FR-27 (`Historias.md:432`) dicen «con un proveedor real ordena la devolución del importe». Se deduce que sin proveedor real no hay importe, pero **no dice** qué guardar en una compra simulada.
3. **Riesgo.** Datos inconsistentes en compras simuladas. Las estadísticas excluyen simuladas (`stats/service.ts:109`), así que el riesgo de dinero hoy es bajo. Si la fase Stripe copia este modelo, sí habría riesgo de devolución errónea.
4. **Propuesta.** En compras simuladas el formulario no pide importe. El reembolso retira los créditos (R10) y marca la compra como reembolsada sin importe (`refundedEurCents` = 0). Las compras reales siguen exigiendo importe (≤ pagado).
5. **Alternativa.** No permitir reembolsos de compras simuladas (no hay dinero que devolver) o mantener el importe ficticio con marca en auditoría (no recomendado). Elegir según D02.
6. **Cambios.** `reembolso/+page.server.ts` y `.svelte`, `payments/service.ts` (`refund`), `payments/domain/refund.ts` (importe 0 válido para simuladas). Tests: `payments/refund-chargeback.int.test.ts`, `tests/http/admin-refund.test.ts`.

### R12. Reembolso: atomicidad y reenvío (corrección, no decisión)

1. **Hoy.** `credits.withdrawForRefund` escribe en **su propia transacción** (`credits/service.ts:641-656`). Después, `payments.refund` escribe el estado, el importe y la auditoría en **otra** transacción (`payments/service.ts:324-340`). Una caída entre ambas deja los créditos retirados sin estado ni auditoría. Además, `reembolsar` no tiene clave de idempotencia (`reembolso/+page.server.ts:80-101`). Si el formulario se envía dos veces (doble clic o reenvío), la segunda llamada lee el importe ya devuelto y, si el importe parcial aún cabe en lo pagado, lo aplica otra vez: se devuelve dos veces el importe y se retiran dos veces los créditos, mientras la bolsa tenga saldo. **Esto es una deducción del código, no un fallo reproducido.** Hay que confirmarlo con un test.
2. **Spec.** FR-030 (`spec.md:333`) exige que toda escritura que afecte a saldo o reembolsos sea atómica. FR-094 exige auditoría por cada reembolso. El patrón de clave de idempotencia ya existe para el ajuste (`adjustment_keys`, T307).
3. **Riesgo.** Dinero: devolución duplicada en el futuro flujo real con Stripe, y saldo retirado sin rastro en la base de datos actual. Es la prioridad técnica más alta de este documento.
4. **Propuesta.** (a) Una sola transacción para retirada de créditos, estado, importe y auditoría. (b) Clave de idempotencia por formulario, como en el ajuste: un segundo envío con la misma clave no se aplica. (c) Un test de integración con dos envíos seguidos de un reembolso parcial, que espere una sola aplicación.
5. **Alternativa.** Permitir un único reembolso parcial por compra. Es más simple, pero limita al admin (no es lo que pide la spec).
6. **Cambios.** `payments/service.ts`, `credits/service.ts` (`withdrawForRefund` debe poder ejecutarse dentro de una transacción existente), una migración nueva para la clave de reembolso, `reembolso/+page.server.ts`. Tests: `payments/refund-chargeback.int.test.ts` (doble envío), `tests/http/admin-refund.test.ts`.

### R13. Copia de predeterminados: solo desde la cuenta del propio administrador

1. **Hoy.** La página W43 toma el usuario de la URL (`copiar/+page.server.ts:32`) y la acción lo toma del formulario (`:46-47`). No compara con `admin.id`. La vista previa muestra el documento de cualquier cuenta (`:34`, `sync/service.ts:210-218`). Su prueba HTTP actual copia desde una cuenta sembrada (`tests/http/admin-predeterminados.test.ts`, según T312), así que esa prueba confirma el comportamiento que hay que cambiar.
2. **Spec.** BE-FR-42 (`Historias.md:591`) dice que la copia «toma el documento sincronizado de su propia cuenta». W43 (`contracts/web-routes.md:616`) dice «del propio administrador». Desviación.
3. **Riesgo.** Privacidad. El admin puede ver prompts, sustituciones y textos de cualquier usuario, y la auditoría no registra de qué cuenta vinieron (R09). Esto no está en la spec como permiso, así que es un acceso que la spec no concede.
4. **Propuesta.** Quitar el parámetro `usuario`. La copia usa siempre `locals.user.id` del administrador. Si el admin no tiene datos en esa app, mensaje «Tu cuenta no tiene datos en esta app». La auditoría registra la cuenta origen (que será la del admin).
5. **Alternativa.** Permitir copiar de otra cuenta con motivo obligatorio y el id de la cuenta origen en la auditoría. Requiere decisión del propietario y enmienda de BE-FR-42. No la recomiendo (D03).
6. **Cambios.** `copiar/+page.server.ts`, `copiar/+page.svelte` (quitar el campo `usuario`), `sync/service.ts` (auditoría con origen), `tests/http/admin-predeterminados.test.ts` (reescribir el caso de copia), `sync/sync.int.test.ts`.

### R14. Qué cuenta como «datos personales» en la copia

1. **Hoy.** No hay ninguna marca de datos personales en el esquema de sincronización. Solo hay casillas por elemento, sin preselección (T312).
2. **Spec.** US6 esc. 5 (`spec.md:147`) dice que el admin «puede excluir datos personales». W43 (`contracts/web-routes.md:617`) pide que no haya ninguna decisión por defecto que favorezca copiar datos personales. **No define** qué es un dato personal en Secretario.
3. **Riesgo.** Privacidad alta. Si el admin copia por error un nombre, un teléfono o un cliente de una sustitución, ese dato pasa a los predeterminados y BE-FR-40 lo siembra en **todas** las cuentas nuevas que usen la app.
4. **Propuesta.** Que el propietario liste las categorías y elementos personales de Secretario (D14). El esquema de sincronización marca esas categorías con `personal: true` (campo opcional, validado por `SyncSchema`). La vista previa las muestra sin marcar y con un aviso.
5. **Alternativa.** Sin marca en el esquema: revisión manual con un aviso fijo en la pantalla. Es más débil, pero no cambia el esquema.
6. **Cambios.** `apps/json-schemas.ts` (`SyncCategory`), `sync/service.ts` (`previewCopy`), `copiar/+page.svelte` (aviso y marcas). Tests: `sync/sync.int.test.ts`, `tests/http/admin-predeterminados.test.ts`.

### R15. Alta de app: formato del slug, carrera y cambio posterior

1. **Hoy.** El slug se recorta (`routes/(web)/admin/apps/+page.server.ts:49`) y solo se valida que no esté vacío (`:51`). El formato lo impone la base de datos: minúsculas, empieza por letra, solo `a-z`, `0-9` y `-` (`apps/schema.ts:68-69`). Un slug con mayúsculas llega hasta la base de datos y vuelve como `VALIDATION_ERROR` genérico (`apps/service.ts:668-670`), no como error de campo. La comprobación de `SLUG_TAKEN` se hace fuera de la transacción (`apps/service.ts:640-641`). Un choque concurrente cae en el mismo `catch` y devuelve `VALIDATION_ERROR`, no `409 SLUG_TAKEN`. No hay longitud máxima. En las rutas que he leído no hay ninguna acción que cambie el slug; no he verificado todo el servicio.
2. **Spec.** BE-FR-62 (`Historias.md:170`) lo describe como «identificador estable». W39 (`contracts/web-routes.md:578-579`) define `409 SLUG_TAKEN`. La spec no fija formato, longitud ni si puede cambiar.
3. **Riesgo.** Bajo en dinero. Es un riesgo de datos: la app cliente envía su slug en cada petición (`X-App-Id`, BE-FR-62 CA1). Un slug cambiado después rompe todas las instalaciones de esa app. La UX es pobre: el admin no sabe qué formato usar.
4. **Propuesta.** Formato `^[a-z][a-z0-9-]{1,39}$` (de 2 a 40 caracteres), con error de campo `slug_format` en el formulario y ayuda visible. Capturar el fallo de unicidad dentro de la transacción y devolver `409 SLUG_TAKEN`. Slug **inmutable** después del alta, con el campo mostrado como no editable en la ficha (D10). La longitud máxima requiere migración del `CHECK`.
5. **Alternativa.** Permitir cambiar el slug con redirección temporal. No lo recomiendo: las apps cliente tendrían que actualizarse a la vez.
6. **Cambios.** `routes/(web)/admin/apps/+page.server.ts` y `.svelte` (validación y mensajes), `apps/service.ts` (captura de unicidad), `apps/schema.ts` (longitud, con migración), `src/params/appSlug.ts` (mismo formato). Tests: `apps/apps.int.test.ts`, `tests/http/admin-apps.test.ts`.

### R16. Liberar el freno global: motivo, previsualización y reactivación

1. **Hoy.** `liberarFreno` valida el motivo (`routes/(web)/admin/protecciones/+page.server.ts:118-119`), pero llama a `releaseBrake(brake, admin.id)` sin pasarlo (`:120`). El servicio registra `reason: 'manual'` (`protections/service.ts:278`). El motivo que escribe el admin se pierde. No existe `previsualizarLiberacionFreno`, que W44 sí define (`contracts/web-routes.md:625-626`). `releaseBrake` devuelve `false` si el freno no está activo hoy (`protections/service.ts:262-267`), pero la ruta no lo comprueba y redirige igual.
2. **Spec.** BE-FR-46 (`Historias.md:610`): el freno dura «hasta el día siguiente o hasta que el administrador lo libere». FR-094 exige motivo en auditoría. **No dice** si, tras liberar, el freno vuelve a saltar si el coste sigue alto. No he verificado cómo lo comprueba el código en cada operación.
3. **Riesgo.** Liberar el freno permite gasto que el sistema había frenado. La auditoría no guarda por qué. El admin cree que ha liberado algo que quizá ya no estaba activo.
4. **Propuesta.** Pasar el motivo a `releaseBrake` y guardarlo en la auditoría. Añadir la vista previa (estado, día, coste acumulado y cuentas afectadas). Si `releaseBrake` devuelve `false`, mostrar aviso. Reactivación: la liberación dura hasta medianoche en Madrid (lo que dice BE-FR-46), aunque el coste siga alto (D11).
5. **Alternativa.** Reevaluar el freno en cada operación tras la liberación, de modo que vuelva a saltar. Es más prudente en dinero, pero se aparta de la letra de BE-FR-46.
6. **Cambios.** `protections/service.ts` (`releaseBrake` con motivo), `routes/(web)/admin/protecciones/+page.server.ts` y `.svelte` (previsualización y aviso), tests `protections/*.int.test.ts` y `tests/http/admin-protecciones.test.ts` (requiere freno activo).

### R17. Retención de las claves de idempotencia del ajuste

1. **Hoy.** Cada carga del formulario de ajuste genera una clave nueva (`ajuste/+page.server.ts:73-74`). Las claves se guardan en `adjustment_keys` y se borran a los 400 días con la tarea `adjustment-keys-cleanup` (T307, `tasks.md:593`).
2. **Spec.** No dice nada sobre retención.
3. **Riesgo.** Muy bajo. Una clave antigua solo se reenvía si alguien envía un formulario de hace más de 400 días. La clave es un UUID nuevo por carga.
4. **Propuesta.** Mantener 400 días y documentarlo en la ficha de operación del sistema (`docs/operaciones/`).
5. **Alternativa.** 30 días, que cubre de sobra un reenvío real. Elegirla si se quiere una tabla más pequeña.
6. **Cambios.** Ninguno si se mantiene. Si se cambia: la tarea `adjustment-keys-cleanup`. Tests: `credits.int.test.ts`.

## 4. Tabla resumen

| Regla                                         | Recomendación                                                   | ¿Bloquea algo?                                             |
| --------------------------------------------- | --------------------------------------------------------------- | ---------------------------------------------------------- |
| R01 Techo de sobrescrituras por app           | Aplicar a las cuatro claves con global                          | Sí: T313 (límites por app) no cumple FR-004 y `spec.md:18` |
| R02 Bajar global bajo una sobrescritura       | Rechazar y listar apps y valores                                | No                                                         |
| R03 Rangos de protecciones                    | Tabla propuesta en R03 (D08)                                    | No, pero sin rangos el freno puede quedar en 0             |
| R04 Tope de ajuste                            | 100 000 créditos por ajuste, con euros en la vista previa (D04) | Sí: T307 queda pendiente de D04                            |
| R05 Caducidad del ajuste                      | Fin de día Madrid y máximo 365 días (D13)                       | Sí: T307 (zona fijada por la spec)                         |
| R06 Resta por tipo de bolsa                   | Limitar al tipo, mostrar disponible por tipo (D05)              | Sí: T307 (la vista previa promete un resultado falso)      |
| R07 Ajuste sobre cuenta bloqueada             | Sumas bloqueadas, restas permitidas (D12)                       | No                                                         |
| R08 Motivo en todas las acciones que escriben | Motivo obligatorio, 1–500, en todas (D09)                       | Sí: T310 (alta de app) y T321 (matriz de motivo)           |
| R09 Auditoría con anterior y nuevo            | Snapshot completo del documento                                 | Sí: T312 (no cumple FR-094)                                |
| R10 Créditos a retirar en reembolso           | Seguir la spec: el admin indica `creditsToRemove` (D01)         | Sí: T308 solo cierra con D01                               |
| R11 Importe en compras simuladas              | No pedir importe en simuladas (D02)                             | Sí: T308                                                   |
| R12 Atomicidad y reenvío del reembolso        | Una transacción y clave de idempotencia (corrección)            | Sí: T308. Corrección urgente, no requiere decisión         |
| R13 Copia solo de la cuenta propia            | Quitar el parámetro `usuario` (D03)                             | Sí: T312 (no cumple BE-FR-42)                              |
| R14 Datos personales en la copia              | Marcar categorías personales en el esquema (D14)                | Sí: T312 (criterio US6 esc. 5)                             |
| R15 Slug: formato, carrera e inmutabilidad    | Formato propuesto, 409 en carrera, slug inmutable (D10)         | No                                                         |
| R16 Liberar freno                             | Motivo en auditoría, previsualización y aviso (D11)             | Sí: T313 (liberación con motivo y evento)                  |
| R17 Retención de claves del ajuste            | Mantener 400 días                                               | No                                                         |

## 5. Decisiones que necesito del propietario

Respuestas cerradas. Donde se pide «sí/no», la respuesta por defecto es la recomendación.

- **D01 (R10). Reembolso: ¿cómo se calculan los créditos a retirar?**
  - a) El administrador escribe los créditos a retirar (lo que dice la spec). **Recomendado.**
  - b) Se calculan en proporción al importe (lo que hace el código). Obliga a enmendar BE-FR-27, US6 esc. 7 y W37.
- **D02 (R11). Reembolso de compras simuladas: ¿se pide importe en euros?**
  - a) No. Solo se retiran créditos y la compra queda reembolsada sin importe. **Recomendado.**
  - b) Sí, como importe ficticio.
  - c) No se pueden reembolsar compras simuladas.
- **D03 (R13). Copia de predeterminados: ¿solo desde la cuenta del propio administrador?**
  - Sí. **Recomendado.** / No (habría que definir motivo obligatorio y auditoría con cuenta origen, y enmendar BE-FR-42).
- **D04 (R04). Ajustes de saldo: ¿tope por ajuste?**
  - a) Tope de 100 000 créditos por ajuste, con equivalente en euros en la vista previa. **Recomendado.**
  - b) Sin tope; solo equivalente en euros en la vista previa.
  - c) Sin tope; confirmación reforzada por encima de 10 000 créditos.
- **D05 (R06). Resta de saldo por tipo de bolsa.**
  - a) La resta se limita al tipo elegido, y la vista previa muestra el disponible por tipo. **Recomendado.**
  - b) La resta sigue el orden de consumo y el tipo solo se usa para sumar.
- **D06 (R01). Techo de sobrescrituras.**
  - ¿Aplicar el techo también a `max_text_chars` y `max_image_mb`? Sí (**recomendado**) / No.
  - ¿Poner techo a las cuatro claves sin global (`max_audio_seconds`, `audio_duration_tolerance_seconds`, `max_audio_mb`, `max_sync_doc_kb`)? Sí / No (**recomendado**: no, mientras la spec no diga otra cosa).
- **D07 (R02). Bajar un global por debajo de una sobrescritura.**
  - a) Rechazar, con detalle de las apps y valores. **Recomendado.**
  - b) Recortar las sobrescrituras en la misma operación, con auditoría de cada una.
- **D08 (R03). Rangos de los parámetros de protección.**
  - a) Aceptar la tabla de R03. **Recomendado.**
  - b) Aceptar la tabla con cambios (indicar cuáles).
  - c) Solo exigir mínimo 1 (sin máximos).
- **D09 (R08). Motivo obligatorio.**
  - ¿Exigir motivo en tester, desactivar anuncio y desactivar operación? Sí (**recomendado**, lo pide FR-094) / No (habría que enmendar FR-094).
- **D10 (R15). Slug de app.**
  - ¿Formato `^[a-z][a-z0-9-]{1,39}$` y slug no editable tras el alta? Sí (**recomendado**) / No.
- **D11 (R16). Freno liberado.**
  - a) La liberación dura hasta medianoche en Madrid, aunque el coste siga alto. **Recomendado** (es lo que dice BE-FR-46).
  - b) Tras liberar, el freno se reevalúa en cada operación.
- **D12 (R07). Ajustes sobre cuentas bloqueadas.**
  - a) Se permiten solo restas. **Recomendado.**
  - b) No se permite ningún ajuste hasta desbloquear.
  - c) Sin restricción.
- **D13 (R05). Horizonte de la caducidad de un ajuste gratuito.**
  - a) Máximo 365 días. **Recomendado.**
  - b) Máximo 90 días.
  - c) Sin máximo.
- **D14 (R14). Datos personales de Secretario.** Pregunta abierta, no cerrada: ¿qué categorías o elementos del documento de sincronización son datos personales? Sin esta lista no se puede marcar nada en el esquema. **Resuelta el 2026-10-30:** solo la categoría `prompts` es personal; `customReplacements`, `coreReplacements`, `quickTexts` y las 10 claves de `preferences` no lo son. Se marca con `personal: true` en el esquema; la vista previa de la copia la avisa y no preselecciona nada.

**Las tres decisiones más urgentes:**

1. **D01 (R10):** el reembolso hoy no hace lo que dice la spec y el cálculo proporcional no contempla saldo parcialmente consumido. Bloquea T308.
2. **D03 (R13):** la copia de predeterminados deja ver el documento sincronizado de cualquier cuenta, fuera de lo que dice BE-FR-42. Es un tema de privacidad.
3. **D05 (R06):** la vista previa de la resta por tipo de bolsa promete un resultado que luego no se cumple. Bloquea T307 en su parte de preview.

Aparte de estas tres, R12 (reembolso con reenvío posible y dos transacciones) es una corrección técnica que conviene hacer ya, sin esperar a decisiones. Está deducida del código y falta confirmarla con un test.

## 6. Qué no he podido verificar

- No ejecuté tests, build ni Playwright, por encargo.
- El comportamiento de R12 (reenvío de un reembolso parcial) está deducido del código, no reproducido.
- No he leído el comprobador del freno en cada operación, así que la reactivación de R16 no está verificada.
- No he comprobado si ya existe un helper de fin de día en Europe/Madrid (R05).
- No he leído todo el servicio de apps para confirmar que no hay ninguna acción que cambie el slug (R15).
- No he leído el limitador de peticiones por app (`ai_requests_per_minute`) para confirmar cómo aplica la sobrescritura por app; solo he leído su configuración.
