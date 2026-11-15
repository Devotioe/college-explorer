import { index, integer, primaryKey, real, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const courses = sqliteTable(
  "courses",
  {
    id: text("id").primaryKey(),
    school: text("school").notNull(),
    code: text("code").notNull(),
    titleZh: text("title_zh").notNull(),
    titleEn: text("title_en").notNull(),
    department: text("department").notNull(),
    credits: real("credits").notNull(),
    level: text("level").notNull(),
    topics: text("topics").notNull(),
    description: text("description"),
    objectives: text("objectives"),
    prerequisites: text("prerequisites"),
    syllabusUrl: text("syllabus_url"),
    syllabusSource: text("syllabus_source"),
    offeredTerms: text("offered_terms"),
    requirement: text("requirement"),
  },
  (table) => [index("courses_school_idx").on(table.school), index("courses_code_idx").on(table.code)],
);

export const courseOfferings = sqliteTable(
  "course_offerings",
  {
    id: text("id").primaryKey(),
    courseId: text("course_id").notNull().references(() => courses.id),
    semester: text("semester").notNull(),
    section: text("section").notNull(),
    teacher: text("teacher").notNull(),
    language: text("language").notNull(),
    schedule: text("schedule").notNull(),
    capacity: integer("capacity"),
    source: text("source").notNull(),
  },
  (table) => [index("course_offerings_course_id_idx").on(table.courseId), index("course_offerings_semester_idx").on(table.semester)],
);

export const courseTopics = sqliteTable(
  "course_topics",
  {
    courseId: text("course_id").notNull().references(() => courses.id),
    topic: text("topic").notNull(),
  },
  (table) => [primaryKey({ columns: [table.courseId, table.topic] }), index("course_topics_topic_idx").on(table.topic)],
);

export const recommendationMaps = sqliteTable(
  "recommendation_maps",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull(),
    name: text("name").notNull(),
    payload: text("payload").notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [index("recommendation_maps_user_id_idx").on(table.userId)],
);

export const passwordUsers = sqliteTable(
  "password_users",
  {
    id: text("id").primaryKey(),
    email: text("email").notNull().unique(),
    displayName: text("display_name").notNull(),
    passwordSalt: text("password_salt").notNull(),
    passwordHash: text("password_hash").notNull(),
    passwordIterations: integer("password_iterations").notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [index("password_users_email_idx").on(table.email)],
);

export const passwordSessions = sqliteTable(
  "password_sessions",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull().references(() => passwordUsers.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull().unique(),
    expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [index("password_sessions_user_id_idx").on(table.userId), index("password_sessions_expires_at_idx").on(table.expiresAt)],
);

export const transcriptUploads = sqliteTable(
  "transcript_uploads",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull().references(() => passwordUsers.id, { onDelete: "cascade" }),
    fileName: text("file_name").notNull(),
    fileType: text("file_type").notNull(),
    status: text("status").notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
    confirmedAt: integer("confirmed_at", { mode: "timestamp_ms" }),
  },
  (table) => [index("transcript_uploads_user_id_idx").on(table.userId)],
);

export const transcriptCourseRows = sqliteTable(
  "transcript_course_rows",
  {
    id: text("id").primaryKey(),
    transcriptId: text("transcript_id").notNull().references(() => transcriptUploads.id, { onDelete: "cascade" }),
    term: text("term").notNull(),
    courseCode: text("course_code").notNull(),
    courseName: text("course_name").notNull(),
    credits: real("credits"),
    gradeRaw: text("grade_raw").notNull(),
    gradeNumeric: real("grade_numeric"),
    matchConfidence: real("match_confidence").notNull(),
    confirmed: integer("confirmed", { mode: "boolean" }).notNull(),
  },
  (table) => [index("transcript_course_rows_transcript_id_idx").on(table.transcriptId), index("transcript_course_rows_course_code_idx").on(table.courseCode)],
);
