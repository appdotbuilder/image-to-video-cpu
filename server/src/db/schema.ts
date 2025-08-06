
import { serial, text, pgTable, timestamp, numeric, integer, pgEnum } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// Define project status enum
export const projectStatusEnum = pgEnum('project_status', ['pending', 'processing', 'completed', 'failed']);

// Video projects table
export const videoProjectsTable = pgTable('video_projects', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  status: projectStatusEnum('status').notNull().default('pending'),
  output_path: text('output_path'), // Nullable - set when video is generated
  duration_per_image: numeric('duration_per_image', { precision: 5, scale: 2 }).notNull().default('2.00'), // seconds
  fps: integer('fps').notNull().default(30), // frames per second
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull()
});

// Images table
export const imagesTable = pgTable('images', {
  id: serial('id').primaryKey(),
  project_id: integer('project_id').references(() => videoProjectsTable.id, { onDelete: 'cascade' }).notNull(),
  filename: text('filename').notNull(),
  file_path: text('file_path').notNull(),
  file_size: integer('file_size').notNull(), // bytes
  mime_type: text('mime_type').notNull(),
  order_index: integer('order_index').notNull(), // for ordering images in video
  uploaded_at: timestamp('uploaded_at').defaultNow().notNull()
});

// Relations
export const videoProjectsRelations = relations(videoProjectsTable, ({ many }) => ({
  images: many(imagesTable)
}));

export const imagesRelations = relations(imagesTable, ({ one }) => ({
  project: one(videoProjectsTable, {
    fields: [imagesTable.project_id],
    references: [videoProjectsTable.id]
  })
}));

// TypeScript types for the table schemas
export type VideoProject = typeof videoProjectsTable.$inferSelect;
export type NewVideoProject = typeof videoProjectsTable.$inferInsert;
export type Image = typeof imagesTable.$inferSelect;
export type NewImage = typeof imagesTable.$inferInsert;

// Export all tables and relations for proper query building
export const tables = { 
  videoProjects: videoProjectsTable, 
  images: imagesTable 
};
