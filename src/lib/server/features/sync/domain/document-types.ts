// Tipo del documento de sincronización (BE-FR-39): un objeto JSON por categoría, con la forma que fija el esquema de la app.
// La validación de esa forma vive en `document-schema.ts`; aquí solo está el tipo, sin lógica, para que el esquema de BD lo use.
export type SyncData = Readonly<Record<string, unknown>>;
