CREATE TABLE `password_sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`token_hash` text NOT NULL,
	`expires_at` integer NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `password_users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `password_sessions_token_hash_unique` ON `password_sessions` (`token_hash`);--> statement-breakpoint
CREATE INDEX `password_sessions_user_id_idx` ON `password_sessions` (`user_id`);--> statement-breakpoint
CREATE INDEX `password_sessions_expires_at_idx` ON `password_sessions` (`expires_at`);--> statement-breakpoint
CREATE TABLE `password_users` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`display_name` text NOT NULL,
	`password_salt` text NOT NULL,
	`password_hash` text NOT NULL,
	`password_iterations` integer NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `password_users_email_unique` ON `password_users` (`email`);--> statement-breakpoint
CREATE INDEX `password_users_email_idx` ON `password_users` (`email`);--> statement-breakpoint
CREATE TABLE `transcript_course_rows` (
	`id` text PRIMARY KEY NOT NULL,
	`transcript_id` text NOT NULL,
	`term` text NOT NULL,
	`course_code` text NOT NULL,
	`course_name` text NOT NULL,
	`credits` real,
	`grade_raw` text NOT NULL,
	`grade_numeric` real,
	`match_confidence` real NOT NULL,
	`confirmed` integer NOT NULL,
	FOREIGN KEY (`transcript_id`) REFERENCES `transcript_uploads`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `transcript_course_rows_transcript_id_idx` ON `transcript_course_rows` (`transcript_id`);--> statement-breakpoint
CREATE INDEX `transcript_course_rows_course_code_idx` ON `transcript_course_rows` (`course_code`);--> statement-breakpoint
CREATE TABLE `transcript_uploads` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`file_name` text NOT NULL,
	`file_type` text NOT NULL,
	`status` text NOT NULL,
	`created_at` integer NOT NULL,
	`confirmed_at` integer,
	FOREIGN KEY (`user_id`) REFERENCES `password_users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `transcript_uploads_user_id_idx` ON `transcript_uploads` (`user_id`);