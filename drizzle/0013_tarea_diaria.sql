CREATE TABLE `daily_job_runs` (
	`day` text PRIMARY KEY NOT NULL,
	`started_at` integer NOT NULL,
	`finished_at` integer,
	`outcome` text,
	CONSTRAINT "daily_job_runs_day_format" CHECK("day" GLOB '[0-9][0-9][0-9][0-9]-[0-1][0-9]-[0-3][0-9]')
);
