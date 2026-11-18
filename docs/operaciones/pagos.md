# Pagos: reembolsos sin rectificativa

Un reembolso manual (W37, BE-FR-27) se confirma antes de emitir su factura rectificativa. Si la rectificativa falla, el
reembolso queda aplicado sin ella y se registra el evento `payments.refund.corrective_pending` (`warn`), con `reason`
(`error`, `rejected` o `skipped`) y, si `correctPayment` lanzó, `err` (C-04, C-12). El evento no lleva la compra ni importes
(Historias 15.19): la compra se identifica con las consultas de este fichero.

Cómo ejecutar una consulta en el contenedor: `migraciones.md`, «Cómo ejecutar una consulta en el contenedor».

## Cuándo se reintenta

- Solo al reenviar **la misma petición**, con la misma clave del formulario (`refund_keys.key`): el reenvío no vuelve a
  reembolsar y reintenta la rectificativa con el importe y el total guardados en la clave (C-13), sea o no el último
  reembolso de la compra. `invoicing` no la duplica: es idempotente por `issue_key` (`refund:<payment_id>:<total devuelto>`).
- Desde la interfaz no se puede: cada carga de W37 genera una clave nueva y el éxito redirige (C-12). Un envío nuevo del
  formulario es **otro** reembolso.
- Las claves anteriores a la migración 0018 no guardan importe ni total (columnas nulas): su reenvío no reintenta nada.

## Consulta 1: reembolsos sin su rectificativa (claves con importe, desde 0018)

```sql
SELECT k.payment_id, k.key, k.amount_eur_cents, k.refunded_after_eur_cents, k.created_at
FROM refund_keys k
JOIN payments p ON p.id = k.payment_id
WHERE k.status = 'applied'
  AND p.simulated = 0
  AND k.amount_eur_cents > 0
  AND NOT EXISTS (
    SELECT 1 FROM invoices i
    WHERE i.issue_key = 'refund:' || k.payment_id || ':' || k.refunded_after_eur_cents
  )
ORDER BY k.created_at;
```

## Consulta 2: compras con más importe devuelto que rectificado (incluye claves anteriores a 0018)

```sql
SELECT p.id AS payment_id,
       p.refunded_eur_cents,
       COALESCE(-SUM(i.amount_eur_cents), 0) AS rectified_eur_cents
FROM payments p
LEFT JOIN invoices i
  ON i.payment_id = p.id AND i.kind = 'corrective' AND i.issue_key LIKE 'refund:%'
WHERE p.simulated = 0
  AND p.refunded_eur_cents > 0
GROUP BY p.id
HAVING p.refunded_eur_cents > COALESCE(-SUM(i.amount_eur_cents), 0)
ORDER BY p.updated_at DESC;
```

## Cómo leer el resultado

- Las compras simuladas no llevan factura (D02) y quedan fuera. Con el proveedor de facturación desactivado
  (`provider_none`) no se emite ninguna factura y saldrían todos los reembolsos reales: en ese caso el resultado no indica un
  fallo.
- Una compra sin factura inicial (`skipped: not_issued`) no puede tener rectificativa hasta que se emita la inicial.
- Qué hacer con cada fila es decisión del propietario (con la gestoría, si hace falta emitirla fuera de la aplicación).
  Anotar la compra, la clave y la decisión en el registro de operaciones.

> **NO VERIFICADO** en staging. Las dos consultas se han ejecutado contra una base de pruebas con las migraciones reales
> (T404, 2026-11-18).
