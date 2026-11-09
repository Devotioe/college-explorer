CREATE TABLE `recommendation_maps` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`name` text NOT NULL,
	`payload` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `recommendation_maps_user_id_idx` ON `recommendation_maps` (`user_id`);