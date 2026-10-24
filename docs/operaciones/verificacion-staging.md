# Verificación en staging y pruebas manuales

Procedimiento de las comprobaciones que solo se pueden hacer con un entorno desplegado o con una persona delante de la
pantalla (T055, T209, T344, T363, T364, T370 en producción, T372, T373 y T374). Cada una queda **NO VERIFICADO** hasta
que se ejecute y se anote su resultado aquí. El resultado de cada comprobación se registra como **comprobado**,
**pendiente** o **no verificable**; nunca se da por hecha sin evidencia.

Registro: copia la tabla de la sección 10 a `docs/operaciones/registro-verificacion/AAAA-MM-DD.md` con fecha, versión de la
imagen, quién lo ejecuta y el resultado de cada fila.

## 1. Contraste sobre cristal (T055, T363)

Medición manual con la composición real: `SiteHeader`, `SiteFooter`, la `Sidebar` (`glass-chrome`) y el diálogo, en tema
claro y oscuro, con efectos normales y reducidos. Herramienta: el medidor de contraste del navegador o un colorímetro sobre
la pantalla.

- Texto normal ≥ 4,5:1 y texto grande ≥ 3:1 sobre el fondo ambiental (principio XIII).
- Anota el valor medido y el fondo de cada zona.

## 2. Proxy e IP real (T209, T373)

Con Nginx Proxy Manager delante de la aplicación, `XFF_DEPTH=1`:

1. Haz una petición de login desde una IP conocida.
2. Comprueba en el log de la aplicación que la IP registrada es la del cliente, no la del proxy (`X-Forwarded-For`).
3. Comprueba que los límites por IP (`login_per_ip_15min`, `registrations_per_ip_24h`) cuentan por cliente real: 4 intentos
   desde la misma IP bloquean el quinto, y una segunda IP no hereda el bloqueo.
4. Anota la IP registrada, el límite aplicado y la cabecera recibida.

## 3. Clientes de correo (T344)

Enviar desde staging las plantillas de `src/lib/server/features/notifications/emails/` a **Gmail**, **Outlook** y **Apple
Mail**, en modo claro y oscuro (incluida la inversión forzada, si el cliente la aplica). Para cada cliente y cada modo:

- El asunto y la marca se ven correctos.
- El enlace visible también aparece como texto.
- El pie lleva el email de soporte.
- Anota el resultado de cada cliente como **comprobado**, **pendiente** o **no verificable**.

## 4. Auditoría WCAG 2.2 AA (T364)

Con **NVDA** en Windows y **VoiceOver** en iOS, sobre los flujos de 15.17 y las páginas clave: registro, login, saldo, compra
y administración de usuarios. Para cada flujo: el foco es visible, el orden de lectura es lógico, los formularios anuncian
sus errores y los diálogos devuelven el foco al disparador.

## 5. Restauración de Litestream (T372)

Sigue `docs/operaciones/restauracion.md`: restaura la base a un volumen nuevo, arranca la imagen de release y comprueba que
el saldo, las sesiones y el último movimiento coinciden con los del origen.

## 6. Smoke tras cada despliegue (T374)

```
E2E_BASE_URL=https://<staging> pnpm exec playwright test e2e/smoke.spec.ts --project=chromium
```

Comprueba `GET /api/v1/health` y las páginas públicas, sin crear datos. Ejecutar tras cada despliegue.

## 7. Carga de laboratorio contra la imagen de producción (T370)

En la imagen de release con la configuración real de staging (no la de simuladores): una sesión y veinte sesiones,
reservas correctas bajo carga y volumen de logs por petición. Compara con la medición de L12 (T274) y publica ambas junto al
objetivo.

## 8. Web Vitals en el despliegue (T371, INP)

Mide el INP con una interacción real (escribir en un campo y pulsar un botón) en las cinco páginas de 16.8, con perfil móvil y
efectos normales y reducidos. El presupuesto es INP ≤ 200 ms.

## 9. Pruebas no automatizables de la matriz (T357, T358, T361)

Lo que no admite automatización fiable (orientación del dispositivo en un teléfono físico, `forcedColors` en Windows con
alto contraste) se anota a mano aquí, con el sistema operativo y el navegador usados.

## 10. Registro de resultados

| Comprobación                                   | Estado        | Quién | Fecha | Observaciones |
| ---------------------------------------------- | ------------- | ----- | ----- | ------------- |
| 1. Contraste sobre cristal (T055, T363)        | NO VERIFICADO |       |       |               |
| 2. Proxy e IP real (T209, T373)                | NO VERIFICADO |       |       |               |
| 3. Clientes de correo (T344)                   | NO VERIFICADO |       |       |               |
| 4. Auditoría WCAG con NVDA y VoiceOver (T364)  | NO VERIFICADO |       |       |               |
| 5. Restauración de Litestream (T372)           | NO VERIFICADO |       |       |               |
| 6. Smoke tras despliegue (T374)                | NO VERIFICADO |       |       |               |
| 7. Carga contra la imagen de producción (T370) | NO VERIFICADO |       |       |               |
| 8. INP y Web Vitals en el despliegue (T371)    | NO VERIFICADO |       |       |               |
| 9. Matriz no automatizable (T357, T358, T361)  | NO VERIFICADO |       |       |               |
