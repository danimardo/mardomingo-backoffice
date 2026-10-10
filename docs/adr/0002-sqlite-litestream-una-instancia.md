# 0002 — SQLite con Litestream en una sola instancia

- **Estado:** Aceptado (2026-10-10)

## Contexto

El volumen previsto de la v4 es pequeño (una app cliente y usuarios en beta), pero el dinero exige
transacciones estrictas, incluidas las reservas de saldo con peticiones simultáneas. Hay una sola
persona para operar el sistema y el servidor es compartido con otras aplicaciones.

## Decisión

**SQLite** (`better-sqlite3`, modo WAL) como única base de datos, con **Drizzle** para el esquema
y las migraciones, y **Litestream** replicando de forma continua a Backblaze B2 en la UE.
**Una sola instancia** por entorno, con las tareas programadas dentro del proceso (croner). Las
transacciones que afectan al saldo son síncronas (`BEGIN IMMEDIATE`, sin `await` dentro). Los
despliegues paran el contenedor anterior antes de arrancar el nuevo.

## Alternativas consideradas

- **PostgreSQL**: más capacidad de concurrencia y de escalado horizontal, pero añade un servicio
  que operar, respaldar y vigilar, sin una necesidad actual.
- **Turso / libSQL remoto**: añade latencia de red y un proveedor más a cada transacción.
- **Redis o colas para los límites y las tareas**: prohibidos por el principio X mientras no haya
  una necesidad medida.

## Consecuencias

- Operación mínima: un fichero, un proceso y copias continuas.
- Las escrituras se serializan; con transacciones cortas y síncronas basta para el volumen
  previsto. Superar una instancia exigiría enmendar el principio X y un ADR nuevo.
- Los tests de integración usan SQLite real, sin simulaciones de la base de datos.
