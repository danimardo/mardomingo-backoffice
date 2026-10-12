// Forma del esquema de sincronización de una app (BE-FR-39). Es la misma que la de `apps`, copiada en lugar de importada:
// el dominio de `sync` no puede depender de otra funcionalidad (principio IV). Un `SyncSchema` de `apps` encaja aquí.
export type SyncCategory =
	| { readonly strategy: 'items'; readonly key: string; readonly tombstone_ttl_days: number }
	| { readonly strategy: 'block' }
	| { readonly strategy: 'keyed'; readonly keys?: readonly string[] | undefined };

export interface SyncSchema {
	readonly categories: Readonly<Record<string, SyncCategory>>;
}
