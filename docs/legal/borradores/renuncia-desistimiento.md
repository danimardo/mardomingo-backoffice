> BORRADOR: NO VIGENTE. Pendiente de revisión por abogado (Historias.md §12, decisión 4). No se publica ni se muestra a usuarios.

# Renuncia al derecho de desistimiento para contenido digital

Versión del borrador: 0.1 (2026-10-11). Clave `withdrawal_waiver`. Requisito BE-FR-26.

## 1. Qué es

Al comprar créditos, aceptas que el servicio empiece de inmediato y renuncias expresamente al derecho de desistimiento sobre el contenido digital que compras. Los créditos son saldo para usar en las aplicaciones de inmediato, por lo que el servicio comienza en el momento de la compra.

[PENDIENTE ABOGADO: confirmar el marco legal de la renuncia. Se propone el artículo 103 m) del texto refundido de la Ley General para la Defensa de los Consumidores y Usuarios (Real Decreto Legislativo 1/2007), que exige el consentimiento expreso previo y el reconocimiento de la pérdida del derecho, y el plazo de desistimiento de 14 días naturales, que habría que confirmar.]

## 2. Cuándo se pide

- En cada compra, antes de pagar.
- Con una casilla obligatoria. Sin marcarla no se puede completar la compra.
- La casilla no está marcada de antemano.

## 3. Texto de la casilla

Texto propuesto, en la forma que se mostrará al usuario:

> Acepto que la prestación del servicio comience de inmediato tras la compra y reconozco que, al hacerlo, pierdo mi derecho de desistimiento sobre el contenido digital adquirido.

[PENDIENTE ABOGADO: redacción definitiva de la casilla. Debe ser clara, visible y no estar marcada de antemano.]

## 4. Qué se registra

Por cada compra se guarda:

- la aceptación con su fecha y hora;
- la versión del texto aceptado;
- la compra a la que se refiere;
- la dirección IP desde la que se aceptó.

Cada compra registra su propia aceptación, aunque el usuario ya haya renunciado antes. Las compras anteriores conservan la versión del texto que aceptaron. Si cambia el texto, la nueva versión se usa en las compras siguientes.

[PENDIENTE ABOGADO: plazo de conservación de la IP asociada a esta aceptación (ver la política de privacidad).]

## 5. Alcance

La renuncia se refiere al contenido digital que compras: los créditos y su uso en las aplicaciones.

[PENDIENTE ABOGADO: alcance de la renuncia respecto de los créditos comprados y todavía no consumidos. La especificación dice que se renuncia al desistimiento «sobre el contenido digital», pero no distingue entre créditos consumidos y no consumidos.]

## 6. Lo que la renuncia no afecta

La renuncia no limita los derechos legales de conformidad del servicio, es decir, el derecho a que el servicio sea conforme con lo contratado.

[PENDIENTE ABOGADO: alcance de los derechos de conformidad y de la garantía legal, y su relación con la política de reembolsos de los términos de uso.]

Para la política de reembolsos, consulta la sección 6 de los términos de uso.

## 7. Validez

[PENDIENTE ABOGADO: validez de la renuncia al desistimiento (BE-FR-26). Hay que revisar en particular:

- si la información previa al pago y la casilla bastan para el consentimiento expreso que exige la ley;
- si el régimen de personas consumidoras aplica a quien compra con datos fiscales de empresa (tipo `business`);
- si la renuncia puede aplicarse a créditos de bienvenida o gratuitos, que no se pagan.]

## 8. Versión inicial

En la fase inicial el proveedor de pagos es simulado. La compra no cobra dinero ni genera factura, pero la casilla y el registro de la renuncia funcionan igual que en la fase de cobros reales.

[PENDIENTE ABOGADO: revisar este texto cuando se active la fase de cobros reales.]

## 9. Relación con otros documentos

- Los términos de uso regulan los créditos, la compra, los reembolsos y el borrado de la cuenta (secciones 5 a 7).
- La política de privacidad describe cuánto tiempo se conserva la IP asociada a la aceptación y qué ocurre con los datos al borrar la cuenta.
- Si el texto de esta renuncia cambia, cada compra registra la versión vigente en ese momento. Las versiones que requieren aceptación se rigen además por la sección 12 de los términos de uso.

---

## Notas para el revisor (eliminar antes de publicar)

- Fuentes: BE-FR-26 (aceptación previa al pago), BE-FR-27 (reembolsos), BE-FR-28 (contracargos), BE-FR-25 CA4 (intento de compra idempotente) y BE-FR-70 (versiones legales) de `Historias.md`.
- `data-model.md`: la aceptación `withdrawal_waiver` va en `terms_acceptances`, con UNIQUE parcial que la excluye, porque se acepta en cada compra (H-30). `payments.withdrawal_acceptance_id` la enlaza con la compra. La versión sembrada es provisional.
- Decisión 4 de `Historias.md` §12: «validez de la renuncia al desistimiento (BE-FR-26)».
- Los puntos de los apartados 1, 5, 6 y 7 son los que más necesitan al abogado.
