# Migraciones: orden de despliegue y vuelta atrás

Las migraciones de `drizzle/` se aplican solas al arrancar la imagen (`src/hooks.server.ts`, `migrateDatabase`), después de
copiar la base en `pre-migrate/<versión>.db` junto a `DATABASE_PATH` (se conservan las 3 últimas). Una migración ya aplicada no
se vuelve a ejecutar, y una imagen anterior no deshace las posteriores: arranca con el esquema y los datos tal como estén. Por
eso, antes de volver a una imagen anterior, hay que comprobar en este fichero si alguna migración posterior deja datos que esa
imagen no sabe leer.

Probar cada migración en staging antes de producción (constitución, «Datos y almacenamiento»).

Simulacro local de 0017–0020 (2026-11-18, simulacro local, no staging): base migrada hasta 0016 con el journal recortado,
sembrada con el _seed_ y con filas de las tablas afectadas, y migrada con `migrateDatabase` (la función del arranque): aplicó
las 4 pendientes en 34 ms y dejó `pre-migrate/<versión>.db` con 17 migraciones y los datos de antes. Lo verificado de cada
migración va en su sección; nada de esto sustituye la prueba en staging.

## Cómo ejecutar una consulta en el contenedor

La imagen no trae el cliente `sqlite3`. Desde la terminal del contenedor en Coolify, con `better-sqlite3` de la propia
aplicación (directorio `/app`):

```sh
node -e "const db = require('better-sqlite3')(process.env.DATABASE_PATH); console.log(db.prepare(process.argv[1]).all())" "SELECT 1"
```

Para una sentencia que modifica datos, `.run()` en lugar de `.all()`. Antes de modificar nada, hacer una copia de la base
(`restauracion.md`).

`prepare` admite **una sola sentencia**: dos sentencias en la misma cadena fallan con `The supplied SQL string contains more
than one statement`, y se ejecutan con un comando cada una. Tampoco sirve para pasar un fichero de `drizzle/`: su texto empieza
por un comentario `--` y `node` lo toma como una opción (`node: bad option: -- …`). Para volver a ejecutar a mano una migración
(que puede tener varias sentencias), se lee el fichero con `exec`:

```sh
node -e "const db = require('better-sqlite3')(process.env.DATABASE_PATH); db.exec(require('node:fs').readFileSync(process.argv[1], 'utf8')); console.log('ok')" drizzle/<migración>.sql
```

> **Verificado en el simulacro local (2026-11-18, simulacro local, no staging)**: los dos comandos, ejecutados desde la raíz
> del repositorio en Windows (Node 24.22.2, `better-sqlite3` del proyecto) contra copias de una base migrada en el
> _scratchpad_. **No verificado en el contenedor.**

## Claves nuevas de `settings` y vuelta a una imagen anterior (C-60)

El _seed_ de cada arranque inserta las claves de `settings` que falten. Hasta la corrección de C-60 (T451, 2026-11-18),
`readSettings` trataba una clave que no conoce como dato corrupto: una imagen **anterior a esa corrección** a la que se vuelve
no sabe leer las claves que haya sembrado una imagen posterior, y fallan todas las lecturas de parámetros globales (es el
mismo motivo por el que existe la 0020).

Desde T451, `readSettings` omite una clave desconocida, sin tocar la fila, y avisa con `apps.settings.unknown_key` (nivel
`warn`, con el nombre de la clave y sin el valor, una vez por clave y proceso). Volver a una imagen que **incluya** T451 ya no
necesita el paso manual de esta sección: basta con revisar en los registros los avisos `apps.settings.unknown_key`, que
listan las claves que esa imagen ignora (sus valores se conservan y la imagen nueva los vuelve a usar al regresar). Una clave
conocida con un valor no válido sigue siendo corrupción.

El paso manual **sigue haciendo falta** para volver a una imagen anterior a T451, y en particular a la de `staging` del
2026-11-17 (PR #48) o a cualquiera anterior: no conocen `signup_attempts_per_ip_hour`, `resend_verification_per_email_hour`
ni `password_reset_per_email_hour` (C-34 y C-36, T426 y T428), que siembra la imagen siguiente sin migración.

Antes de desplegar una imagen anterior a T451 y a esas claves, con la imagen actual todavía en marcha:

1. Anotar sus valores, por si el administrador los había cambiado:

   ```sql
   SELECT key, value FROM settings WHERE key IN ('signup_attempts_per_ip_hour', 'resend_verification_per_email_hour', 'password_reset_per_email_hour');
   ```

2. Borrarlas (tras copiar la base):

   ```sql
   DELETE FROM settings WHERE key IN ('signup_attempts_per_ip_hour', 'resend_verification_per_email_hour', 'password_reset_per_email_hour');
   ```

Al volver a la imagen actual, su _seed_ las inserta de nuevo con los valores por defecto; si se habían cambiado, reponerlos
desde el panel.

> **Verificado en el simulacro local (2026-11-18, simulacro local, no staging)**, emulando la lectura de la imagen anterior con
> los esquemas Zod de `settings` de `origin/staging` extraídos de git (no se arrancó la imagen): tras migrar y sembrar con la
> imagen actual, las tres claves dan error; tras el paso 2, las 45 filas son válidas; al volver, el _seed_ las inserta (`3`,
> `3` y `10`) y las lecturas funcionan.
>
> **T451 (2026-11-18)**: comprobado con el test de integración `apps/settings-unknown-key.int.test.ts` (una fila
> `zzz_future_key` no impide leer los parámetros y emite el aviso una sola vez, sin el valor), no con una vuelta atrás real.
> **No ensayado en staging** con dos imágenes que incluyan T451.

## 0017 · `prompts` de Secretario como categoría personal (T397, C-05; T399, C-07)

- **Qué hace**: `0017_secretario_prompts_personal.sql` añade `personal: true` a `categories.prompts` del `sync_schema` de
  `secretario`, solo si `prompts` sigue en `block` y no tiene la clave (un esquema cambiado por el administrador no se toca).
- **Orden de despliegue**: después de la imagen del PR #47 (D14), que es la primera que acepta la clave `personal`. El PR #47
  ya está fusionado; T397 va en un despliegue **posterior**, nunca en el mismo.
- **Volver a una imagen anterior al PR #47**: esa imagen valida `sync_schema` con un esquema estricto sin `personal` y trata la
  fila como corrupta: fallarían la lectura de la app en el panel y las peticiones con `X-App-Id: secretario` (confirmado por
  lectura del código; el alcance exacto no se ha probado). Antes de desplegar la
  imagen anterior, con la imagen actual todavía en marcha:

  1. Listar las categorías marcadas como personales (en cualquier app, porque el administrador también puede marcarlas):

     ```sql
     SELECT a.slug, c.key AS category
     FROM apps a, json_each(a.sync_schema, '$.categories') c
     WHERE json_extract(c.value, '$.personal') IS NOT NULL;
     ```

  2. Quitar la clave de `prompts` de `secretario` (la que pone la migración 0017):

     ```sql
     UPDATE apps
     SET sync_schema = json_remove(sync_schema, '$.categories.prompts.personal'),
         updated_at = CAST(strftime('%s', 'now') AS INTEGER) * 1000
     WHERE slug = 'secretario'
       AND json_extract(sync_schema, '$.categories.prompts.personal') IS NOT NULL;
     ```

     Si el paso 1 lista otras filas, repetir la sentencia con su `slug` y su categoría en la ruta
     (`'$.categories.<categoría>.personal'`, también en el `WHERE`).

  3. Repetir el paso 1: no debe devolver ninguna fila. Desplegar la imagen anterior y comprobar `GET /api/v1/health` y una
     petición con `X-App-Id: secretario`.

- **Al volver a la imagen actual**: la migración 0017 consta como aplicada y no se repite. Ejecutar a mano
  `drizzle/0017_secretario_prompts_personal.sql` con el comando de `exec` de «Cómo ejecutar una consulta en el contenedor»
  (con `prepare` no funciona: el fichero empieza por un comentario) para recuperar el aviso de W43, y marcar de nuevo en el
  panel las demás categorías que se hayan desmarcado en el paso 2.
- Una imagen anterior al PR #47 tampoco conoce las claves de `settings` sembradas después: ver «Claves nuevas de `settings` y
  vuelta a una imagen anterior (C-60)».

> **Verificado en el simulacro local (2026-11-18, simulacro local, no staging)** sobre una base migrada hasta 0016 con
> `secretario` sin `personal` y una segunda app con una categoría personal marcada por el administrador: la 0017 marca
> `prompts` y cambia `updated_at`, y no toca la otra app. Con la imagen actual en marcha, el paso 1 lista las dos filas, el
> paso 2 (y su repetición con el `slug` y la categoría de la otra app) cambia una fila cada uno y el paso 3 no devuelve nada; el
> `sync_schema` de `secretario` queda idéntico al de antes de la 0017. La lectura de la imagen anterior al PR #47 se ha
> **emulado** con su `SyncSchema` extraído de git (`7cf96d8^`): rechaza las dos filas con `personal` y acepta las dos tras el
> paso 2. Al volver, el fichero de la 0017 con `exec` marca de nuevo `prompts`. **No ensayado en staging** ni con la imagen
> anterior arrancada (`GET /api/v1/health` y una petición con `X-App-Id: secretario` siguen sin comprobar).

## 0018 · Importe y total en `refund_keys` (T405, C-13)

- **Qué hace**: `0018_refund_keys_importes.sql` recrea `refund_keys` con dos columnas nuevas, `amount_eur_cents` y
  `refunded_after_eur_cents`, nulas en las claves que ya existían, y con sus `CHECK` (las dos a la vez, no negativas y el total
  no menor que el importe). El reenvío de una clave antigua no reintenta su rectificativa (`pagos.md`).
- **Volver a una imagen anterior**: compatible sin cambios en `refund_keys`. La imagen anterior no lee ni escribe las columnas
  nuevas, y las claves que inserte quedan con ambas nulas, que los `CHECK` admiten. Las claves de `settings` sembradas por la
  imagen nueva sí exigen un paso previo (C-60, sección anterior).

> **Verificado en el simulacro local (2026-11-18, simulacro local, no staging)** con tres claves antiguas (`applied`,
> `applied` y `claimed`) de dos compras: tras migrar conservan `key`, `payment_id`, `status`, `created_at` y el orden de
> `rowid`, con las dos columnas nuevas nulas; están el índice `refund_keys_payment_idx`, `PRAGMA foreign_key_check` vacío e
> `integrity_check` `ok`. Una alta y un paso a `applied` con las columnas de la imagen anterior funcionan (ambas nulas); una
> sola columna, un importe negativo o un total menor que el importe fallan con su `CHECK`, y una compra inexistente, con la
> clave foránea.

## 0019 · `sync_documents` rechaza las cuentas borradas (T435, C-43)

- **Qué hace**: `0019_sync_documents_cuenta_borrada.sql` crea dos _triggers_, `sync_documents_deleted_user_no_insert` y
  `sync_documents_deleted_user_no_update`, que abortan (`sync_documents_user_deleted`) un `INSERT` o `UPDATE` de
  `sync_documents` si la cuenta de `user_id` tiene `deleted_at` no nulo (borrada y anonimizada). No toca datos: el borrado
  de la cuenta ya eliminaba sus documentos, y el `DELETE` sigue permitido.
- **Antes de desplegar** (opcional, solo lectura): comprobar que no quedan documentos de cuentas borradas, que la carrera de
  C-43 podría haber dejado. Debe devolver 0; si no, borrarlos es lo que habría hecho el borrado de la cuenta (BE-FR-07 CA1):

  ```sql
  SELECT count(*) FROM sync_documents d JOIN user u ON u.id = d.user_id WHERE u.deleted_at IS NOT NULL;
  -- Solo si la consulta anterior no da 0, y tras copiar la base (restauracion.md):
  DELETE FROM sync_documents WHERE user_id IN (SELECT id FROM user WHERE deleted_at IS NOT NULL);
  ```

  Un documento así que quede no rompe la migración, pero los _triggers_ impiden actualizarlo (la limpieza de marcas de
  borrado los omite).

- **Volver a una imagen anterior**: compatible sin cambios en `sync_documents` (las claves de `settings`, C-60, sí exigen un
  paso previo). Los _triggers_ se quedan (una migración aplicada no se deshace) y la imagen anterior, al chocar con ellos en
  la carrera de C-43, responde `500` en lugar de `401`, sin guardar nada. Si hiciera falta quitarlos, una sentencia por
  comando (`prepare` no admite las dos juntas):

  ```sql
  DROP TRIGGER sync_documents_deleted_user_no_insert;
  ```

  ```sql
  DROP TRIGGER sync_documents_deleted_user_no_update;
  ```

  Al volver a la imagen actual no se recrean solos: ejecutar `drizzle/0019_sync_documents_cuenta_borrada.sql` con el comando de
  `exec` (no es idempotente: si los _triggers_ ya existen, falla con `trigger … already exists` sin cambiar nada) y repetir la
  consulta previa, porque sin los _triggers_ la imagen anterior puede haber guardado documentos de cuentas borradas.

> **Verificado en el simulacro local (2026-11-18, simulacro local, no staging)**: la consulta previa devolvió `1` con un
> documento sembrado de una cuenta borrada; la migración se aplica igual y los dos _triggers_ existen. Con ellos, un `INSERT`
> para una cuenta borrada, un `UPDATE` de su documento y el de una cuenta borrada después de migrar fallan con
> `SQLITE_CONSTRAINT_TRIGGER` (`sync_documents_user_deleted`); en cuentas vivas, `INSERT` y `UPDATE` funcionan, y el `DELETE`
> documentado borra los documentos de cuentas borradas (la consulta vuelve a `0`). Los dos `DROP TRIGGER`, uno por comando,
> los quitan, y entonces un `INSERT` para una cuenta borrada se guarda; el fichero de la 0019 con `exec` los recrea. El
> `DROP TRIGGER` con las dos sentencias en un mismo comando falla. **No ensayado en staging.**

## 0020 · Retirada de `settings.fx_usd_eur` (T447, C-56)

- **Qué hace**: `0020_settings_sin_fx_usd_eur.sql` borra la fila `fx_usd_eur` de `settings`. Desde C-49 (T440) nadie la
  leía: el tipo USD→EUR sale de `fx_rates` y, sin filas, de `DEFAULT_FX_USD_EUR_PPM` (920.000). No toca el esquema y no
  falla si la fila no existe.
- **Por qué no puede quedarse**: la imagen nueva ya no conoce la clave. Sin T451 (C-60), `readSettings` trataba una clave
  desconocida como dato corrupto, con lo que fallarían todas las lecturas de parámetros globales; desde T451 la omitiría con
  un aviso, pero se borra igual para no dejar filas huérfanas. La migración se aplica al arrancar, antes del _seed_ y de
  atender peticiones, así que con el orden normal no hay ventana. Además, el _seed_ de la imagen nueva borra la clave en cada
  arranque (`RETIRED_SETTING_KEYS`), para el caso de la vuelta atrás.
- **Antes de desplegar** (opcional, solo lectura): ver el valor que se va a borrar, por si hace falta reponerlo:

  ```sql
  SELECT key, value, updated_at FROM settings WHERE key = 'fx_usd_eur';
  ```

  Si el valor no es el sembrado (`920000`), anotarlo: no lo lee nadie, pero es el que habría que reponer al volver atrás.

- **Volver a una imagen anterior**: compatible sin cambios. La imagen anterior siembra de nuevo `fx_usd_eur` al arrancar
  (`INSERT … ON CONFLICT DO NOTHING`) con su valor por defecto, y no la lee para cobrar ni para el freno. Si se quiere el
  valor anotado antes de desplegar, con la imagen anterior ya en marcha:

  ```sql
  UPDATE settings SET value = '<valor anotado>' WHERE key = 'fx_usd_eur';
  ```

- **Al volver a la imagen actual**: la migración 0020 consta como aplicada y no se repite, pero el _seed_ borra la fila
  resembrada al arrancar, antes de que nadie lea los parámetros. No hay que hacer nada a mano. (Con T451, aunque se leyera
  antes del _seed_, la fila solo daría el aviso `apps.settings.unknown_key`.)
- La imagen anterior a 0020 (y la de `staging` del 2026-11-17) no conoce las claves de `settings` sembradas por la imagen
  nueva: antes de volver a ella, ver «Claves nuevas de `settings` y vuelta a una imagen anterior (C-60)». Sin ese paso, la
  vuelta atrás de la 0020 **no** es compatible.

> **Verificado en el simulacro local (2026-11-18, simulacro local, no staging)**, con `fx_usd_eur` a `935000` antes de
> migrar: la consulta previa la muestra; tras migrar no está (47 filas). La resiembra de la imagen anterior se **emuló** con
> el `INSERT … ON CONFLICT DO NOTHING` de `920000` (no se arrancó la imagen) y el `UPDATE` documentado repuso `935000`. Al
> volver, `migrateDatabase` no aplica nada (0 pendientes), las lecturas de parámetros fallan antes del _seed_
> (`INTERNAL_ERROR`, la clave desconocida) y funcionan después: el _seed_ borra la fila. **No ensayado en staging.**
