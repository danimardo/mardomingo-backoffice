# Migraciones: orden de despliegue y vuelta atrás

Las migraciones de `drizzle/` se aplican solas al arrancar la imagen (`src/hooks.server.ts`, `migrateDatabase`), después de
copiar la base en `pre-migrate/<versión>.db` junto a `DATABASE_PATH` (se conservan las 3 últimas). Una migración ya aplicada no
se vuelve a ejecutar, y una imagen anterior no deshace las posteriores: arranca con el esquema y los datos tal como estén. Por
eso, antes de volver a una imagen anterior, hay que comprobar en este fichero si alguna migración posterior deja datos que esa
imagen no sabe leer.

Probar cada migración en staging antes de producción (constitución, «Datos y almacenamiento»).

## Cómo ejecutar una consulta en el contenedor

La imagen no trae el cliente `sqlite3`. Desde la terminal del contenedor en Coolify, con `better-sqlite3` de la propia
aplicación (directorio `/app`):

```sh
node -e "const db = require('better-sqlite3')(process.env.DATABASE_PATH); console.log(db.prepare(process.argv[1]).all())" "SELECT 1"
```

Para una sentencia que modifica datos, `.run()` en lugar de `.all()`. Antes de modificar nada, hacer una copia de la base
(`restauracion.md`).

> **NO VERIFICADO.** El comando anterior no se ha ejecutado todavía en el contenedor.

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

- **Al volver a la imagen actual**: la migración 0017 consta como aplicada y no se repite. Ejecutar a mano su sentencia
  (`drizzle/0017_secretario_prompts_personal.sql`) para recuperar el aviso de W43, y marcar de nuevo en el panel las demás
  categorías que se hayan desmarcado en el paso 2.

> **NO VERIFICADO.** La vuelta atrás no se ha ensayado en staging (C-07, verificación manual opcional).

## 0018 · Importe y total en `refund_keys` (T405, C-13)

- **Qué hace**: `0018_refund_keys_importes.sql` recrea `refund_keys` con dos columnas nuevas, `amount_eur_cents` y
  `refunded_after_eur_cents`, nulas en las claves que ya existían, y con sus `CHECK` (las dos a la vez, no negativas y el total
  no menor que el importe). El reenvío de una clave antigua no reintenta su rectificativa (`pagos.md`).
- **Volver a una imagen anterior**: compatible sin cambios. La imagen anterior no lee ni escribe las columnas nuevas, y las
  claves que inserte quedan con ambas nulas, que los `CHECK` admiten.
