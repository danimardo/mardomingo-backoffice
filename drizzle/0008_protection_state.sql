CREATE TABLE `protection_state` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL,
	`updated_at` integer DEFAULT (CAST(unixepoch('subsec') * 1000 AS INTEGER)) NOT NULL,
	CONSTRAINT "protection_state_known_key" CHECK("key" IN ('global_brake')),
	CONSTRAINT "protection_state_value_json" CHECK(json_valid("value"))
);
