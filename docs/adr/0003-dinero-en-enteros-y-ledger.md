# 0003 — Dinero en enteros, ledger de solo inserción y reservas

- **Estado:** Aceptado (2026-10-10)

## Contexto

Las operaciones de IA cuestan fracciones de céntimo, los usuarios pagan con créditos y las
peticiones pueden ser simultáneas. Un error de redondeo o de concurrencia se traduce en dinero
perdido o cobrado de más, y hay que poder reconstruir cualquier saldo.

## Decisión

- Todos los importes son **enteros escalados**: micro-créditos (µc), céntimos de euro,
  micro-USD, y partes por millón (`ppm`) para porcentajes, márgenes y tipos de cambio, con
  `BigInt` en los productos intermedios. PROHIBIDO usar `number` con decimales para dinero.
- El **ledger** (`credit_movements`) es de solo inserción y lo protegen triggers de SQLite. El
  saldo materializado se puede reconstruir desde el ledger.
- Cada operación de IA **reserva** su coste máximo antes de llamar al proveedor y cobra el coste
  real después; las dos escrituras son transacciones cortas.
- Solo la funcionalidad `credits` escribe en las tablas de saldo (ADR 0005).

## Alternativas consideradas

- **Decimales en coma flotante o librerías decimales**: o pierden precisión o añaden una
  dependencia en el núcleo del dominio para un problema que los enteros resuelven.
- **Saldo mutable sin ledger**: más simple, pero no permite auditar ni reconstruir.
- **Cobrar sin reserva previa**: permite gastar por encima del saldo con peticiones simultáneas.

## Consecuencias

- Los tipos *branded* del dinero (`Micro`) viven en `$lib/shared/`, compartidos por cliente y
  servidor.
- El dominio del dinero son funciones puras sobre enteros, con cobertura del 100 %, tests
  basados en propiedades y mutation testing (principio V).
- La conversión a texto visible pasa siempre por `$lib/format` (BE-FR-22).
