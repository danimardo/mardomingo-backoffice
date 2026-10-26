# Prueba de usabilidad previa al lanzamiento (16.10)

Guion y registro para la prueba de usabilidad de la sección 16.10 de `Historias.md`. Se ejecuta antes del lanzamiento
público con cobros reales, junto a la auditoría manual de accesibilidad (T364). No bloquea el desarrollo de la v4.

## Quién

- De 3 a 5 personas cercanas al proyecto que **no** hayan participado en él.
- Perfiles variados. Si es posible, al menos una persona que use lector de pantalla y una que use solo teclado.

## Condiciones

- Entorno: staging con datos sembrados. Nunca producción.
- Consentimiento previo y por escrito. Sin grabación si la persona no la consiente.
- Datos mínimos: no se piden datos personales reales; las cuentas son de prueba.
- Antes de empezar se explica que se prueba la aplicación, no a la persona.

## Tareas

Cada tarea es un escenario con un objetivo. **No se nombran botones ni enlaces** para no guiar a la persona.

1. Registrarse desde la landing de Secretario y verificar la cuenta.
2. Comprar créditos (simulado, en staging).
3. Averiguar en qué se gastaron créditos el último mes.
4. Cambiar la contraseña.
5. Borrar una cuenta de prueba.

## Registro

Por cada tarea, anotar:

- **Resultado:** completada sin ayuda, completada con ayuda, o no completada.
- **Dónde se atascó** la persona (pantalla y paso).
- **Términos que no entendió** (textos literales).
- **Tiempo aproximado** hasta completar o abandonar.

## Priorización de hallazgos

Cada hallazgo se puntúa por:

- **Consecuencia:** qué pasa si una persona real se encuentra con ello.
- **Frecuencia:** cuántas personas de la prueba lo encontraron.
- **Recuperación:** si la persona puede salir sola del problema.

Los hallazgos se corrigen por orden de prioridad y se repite el recorrido afectado. Se registran como tareas en
`specs/001-cuenta-mardomingo-v4/tasks.md`.

## Qué no hacer con los resultados

- No sacar porcentajes ni conclusiones generales: una muestra de 3 a 5 personas no lo permite.
- No atribuir a la aplicación un fallo que venga del entorno de prueba; anotarlo aparte.

## Estado

- [ ] Guion revisado por el propietario.
- [ ] Personas convocadas y consentimiento recogido.
- [ ] Prueba realizada en staging.
- [ ] Hallazgos priorizados y registrados.

_Estado 2026-10-22: guion preparado; la prueba no se ha realizado. Pendiente del propietario._
