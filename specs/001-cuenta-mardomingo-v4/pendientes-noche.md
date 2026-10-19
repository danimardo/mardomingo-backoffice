# Pendientes del panel de administración (análisis 2026-10-19)

Permisos concedidos por el propietario para esta noche:
- Implementar lo pendiente de forma autónoma; abrir PR a `staging` y fusionarlo cuando «diez puertas» esté en verde.
- No tocar `main`, no hacer force push, no leer ni mostrar secretos.
- No tocar el trabajo ajeno sin commitear (páginas públicas de legal, precios, menú de cuenta, hooks): ni commitearlo, ni borrarlo, ni modificarlo. Mis commits solo incluyen mis ficheros; el índice se revisa antes de cada commit.
- Tareas del propietario (T001, T055, T344, T363, clave `verify-model-caps`, V02–V05, backup de staging): no se hacen; quedan anotadas.
- Para T307, T308, T310, T312, T313 y T321: implementar lo que la especificación defina con claridad; lo ambiguo se anota como decisión pendiente, sin inventar reglas de negocio.

## Estado por tarea

| Tarea | Qué existe | Qué falta | Orden |
|---|---|---|---|
| T316 | W50, W51, CSV, prueba HTTP con sesión | Compras y simuladas dentro del informe completo (`web/accounting-report`) | 1 |
| T306 | Ficha: pagos, consumo, bolsas, facturas, datos fiscales (presencia), vista previa de las cuatro acciones, E2E de búsqueda y vista previa | E2E del paso de confirmación de cada acción | 2 |
| T307 | Ruta `usuarios/[userId]/ajuste` (W36) con servicio de ajustes | Revisar contra T307: prueba de integración de saldo (escribir primero), vista previa, límites | 3 |
| T308 | Ruta `pagos/[paymentId]/reembolso` (W37) | Revisar contra T308: `?/previsualizarReembolso` y `?/reembolsar` con `creditsToRemove` ≤ no consumido; prueba de integración | 4 |
| T310 | Apps W39/W40 parciales (lista, ficha, alta de app, sobrescrituras) | `?/crearApp` con 409 `SLUG_TAKEN`, `?/guardarApp` (enlaces, orígenes, soporte, mantenimiento, versiones); pruebas | 5 |
| T312 | Predeterminados W42 y copia W43 existen | Pruebas de integración de W42–W43 (validación con el esquema de sincronización, no modifica cuentas) | 6 |
| T313 | Protecciones W44 (freno, límites) parcial | `?/previsualizarLimites`/`?/guardarLimites` con origen; `?/liberarFreno` con motivo y evento | 7 |
| T321 | Pruebas de acciones de W35–W44 parciales | Matriz completa de acciones en `admin-actions.int.test.ts` (caso válido, motivo ausente, rol incorrecto) | 8 (al final) |

## Decisiones que no se inventan (quedan anotadas)

- Cambios de precio de paquetes (crear y editar): aplazados por decisión del propietario.
- Qué significa «aplicar al grupo» más allá de la vista previa ya implementada: cerrado.
- Cualquier regla de negocio nueva que la especificación no fije con claridad (p. ej. límites por app si no están en `Historias.md`).

## Verificación obligatoria por tarea

- Pruebas de integración escritas primero cuando la tarea lo pide.
- `pnpm test`, `pnpm build`, `pnpm test:http` y E2E de administración en Chromium antes de abrir el PR.
- Lint de lo tocado. Índice vacío antes de cada commit.
- Lo no verificado se dice como «no verificado» en la nota de `tasks.md`.
