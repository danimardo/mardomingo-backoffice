CREATE TABLE `model_cache` (
	`model_id` text PRIMARY KEY NOT NULL,
	`pricing` text NOT NULL,
	`modalities` text NOT NULL,
	`supported_parameters` text NOT NULL,
	`fetched_at` integer NOT NULL
);
