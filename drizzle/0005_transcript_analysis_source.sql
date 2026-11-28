CREATE TABLE `transcript_analysis_sources` (
	`user_id` text PRIMARY KEY NOT NULL,
	`transcript_id` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `password_users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`transcript_id`) REFERENCES `transcript_uploads`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `transcript_analysis_sources_transcript_id_idx` ON `transcript_analysis_sources` (`transcript_id`);