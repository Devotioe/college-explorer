import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

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
