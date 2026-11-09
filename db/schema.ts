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
