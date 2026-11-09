CREATE TABLE `course_offerings` (
	`id` text PRIMARY KEY NOT NULL,
	`course_id` text NOT NULL,
	`semester` text NOT NULL,
	`section` text NOT NULL,
	`teacher` text NOT NULL,
	`language` text NOT NULL,
	`schedule` text NOT NULL,
	`capacity` integer,
	`source` text NOT NULL,
	FOREIGN KEY (`course_id`) REFERENCES `courses`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `course_offerings_course_id_idx` ON `course_offerings` (`course_id`);--> statement-breakpoint
CREATE INDEX `course_offerings_semester_idx` ON `course_offerings` (`semester`);--> statement-breakpoint
CREATE TABLE `course_topics` (
	`course_id` text NOT NULL,
	`topic` text NOT NULL,
	PRIMARY KEY(`course_id`, `topic`),
	FOREIGN KEY (`course_id`) REFERENCES `courses`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `course_topics_topic_idx` ON `course_topics` (`topic`);--> statement-breakpoint
CREATE TABLE `courses` (
	`id` text PRIMARY KEY NOT NULL,
	`school` text NOT NULL,
	`code` text NOT NULL,
	`title_zh` text NOT NULL,
	`title_en` text NOT NULL,
	`department` text NOT NULL,
	`credits` real NOT NULL,
	`level` text NOT NULL,
	`topics` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `courses_school_idx` ON `courses` (`school`);--> statement-breakpoint
CREATE INDEX `courses_code_idx` ON `courses` (`code`);