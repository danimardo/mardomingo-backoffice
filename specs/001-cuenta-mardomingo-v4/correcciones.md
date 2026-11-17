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

| Id   | Gravedad | Área     | Resumen                                                                             | Tarea |
| ---- | -------- | -------- | ----------------------------------------------------------------------------------- | ----- |
| C-01 | Alta     | payments | El contracargo de una compra `partially_refunded` se descarta                       | T393  |
| C-02 | Media    | credits  | Una reserva caducada sigue restando saldo disponible hasta la tarea diaria          | T394  |
| C-03 | Media    | payments | El informe contable cuenta dos veces lo ya devuelto cuando hay contracargo          | T395  |
| C-04 | Baja     | payments | Si la rectificativa falla tras confirmar el reembolso, no se reintenta nunca        | T396  |

---

## C-01 (Alta) — El contracargo de una compra parcialmente reembolsada se descarta

- **Requisito**: BE-FR-28; `data-model.md` 4.5 (`completed / partially_refunded` + `chargeback_opened` → `chargeback`).
- **Fichero**: `src/lib/server/features/payments/service.ts`, función `applyEvent` (rama `chargeback_opened`).
- **Estado**: confirmado por lectura.
- **Qué pasa**: la condición `row.status !== 'completed' && row.status !== 'refunded'` rechaza el evento
  (`payments.webhook.rejected`, `not_completed`) cuando la compra está en `partially_refunded`. Resultado: no se retira el
  saldo restante, no hay deuda, no se bloquea la cuenta y no hay rectificativa. Además acepta `refunded`, que la tabla de
  transiciones no contempla (es inocuo: el objetivo sale 0, pero bloquea la cuenta).
- **Cambio**: aceptar `completed` y `partially_refunded`. Para `refunded`, **decidido por el propietario (2026-11-17)**: se
  acepta y bloquea la cuenta; pasa a `chargeback` sin movimiento de créditos (ya se retiraron todos) ni rectificativa (importe
  pendiente 0). Enmendar `data-model.md` 4.5 para añadir `refunded` + `chargeback_opened` → `chargeback`, y cubrirlo con un
  segundo caso en el mismo test.

  ```ts
  const chargeable =
  	row.status === 'completed' || row.status === 'partially_refunded' || row.status === 'refunded';
  if (!chargeable) { /* rechazo actual */ }
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
- **Estado**: confirmado por lectura.
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
- **Estado**: confirmado por lectura.
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
- **Estado**: confirmado por lectura. Sin efecto en la v4 (proveedor de facturación `none`); importa al activar la facturación.
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
