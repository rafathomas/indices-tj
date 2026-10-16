CREATE TABLE `index_values` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `index_slug` text NOT NULL,
  `index_name` text NOT NULL,
  `reference_year` integer NOT NULL,
  `month` integer NOT NULL,
  `value` real NOT NULL,
  `source_url` text NOT NULL,
  `collected_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `index_values_period` ON `index_values` (`index_slug`,`reference_year`,`month`);
