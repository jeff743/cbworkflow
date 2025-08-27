import { sql } from 'drizzle-orm';
import {
  index,
  jsonb,
  pgTable,
  timestamp,
  varchar,
  text,
  integer,
  boolean,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Session storage table for Replit Auth
export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)],
);

// User storage table for Replit Auth
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: varchar("email").unique(),
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  profileImageUrl: varchar("profile_image_url"),
  role: varchar("role").notNull().default("creative_strategist"), // super_admin, growth_strategist, creative_strategist
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Projects table
export const projects = pgTable("projects", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: varchar("name").notNull(),
  description: text("description"),
  clientName: varchar("client_name"),
  status: varchar("status").notNull().default("active"), // active, paused, completed
  backgroundImages: text("background_images").array(), // Array of background image URLs for this project
  createdBy: varchar("created_by").notNull().references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Statements table
export const statements = pgTable("statements", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  projectId: varchar("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  testBatchId: varchar("test_batch_id"), // Groups statements created together as a test
  description: text("description"), // Task description for the test batch
  deploymentStatus: varchar("deployment_status").default("pending"), // pending, ready, deploying, deployed, completed, failed
  deploymentReadyDate: timestamp("deployment_ready_date"),
  heading: text("heading"),
  content: text("content").notNull(),
  status: varchar("status").notNull().default("draft"), // draft, under_review, needs_revision, approved
  priority: varchar("priority").notNull().default("normal"), // normal, high, urgent
  dueDate: timestamp("due_date"),
  assignedTo: varchar("assigned_to").references(() => users.id),
  growthStrategistId: varchar("growth_strategist_id").references(() => users.id), // Growth Strategist assigned to review this test
  createdBy: varchar("created_by").notNull().references(() => users.id),
  reviewedBy: varchar("reviewed_by").references(() => users.id),
  reviewNotes: text("review_notes"),
  // Colorblock settings
  headingFontSize: integer("heading_font_size").default(48),
  statementFontSize: integer("statement_font_size").default(43),
  footerFontSize: integer("footer_font_size").default(35),
  textAlignment: varchar("text_alignment").default("center"), // left, center, right
  backgroundColor: varchar("background_color").default("#4CAF50"),
  backgroundImageUrl: varchar("background_image_url"),
  footer: text("footer"), // Optional footer text
  // Generated colorblock image
  colorblockImageUrl: varchar("colorblock_image_url"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Relations
export const usersRelations = relations(users, ({ many }) => ({
  createdProjects: many(projects, { relationName: "creator" }),
  assignedStatements: many(statements, { relationName: "assignee" }),
  createdStatements: many(statements, { relationName: "creator" }),
  reviewedStatements: many(statements, { relationName: "reviewer" }),
}));

export const projectsRelations = relations(projects, ({ one, many }) => ({
  creator: one(users, {
    fields: [projects.createdBy],
    references: [users.id],
    relationName: "creator",
  }),
  statements: many(statements),
}));

export const statementsRelations = relations(statements, ({ one }) => ({
  project: one(projects, {
    fields: [statements.projectId],
    references: [projects.id],
  }),
  assignee: one(users, {
    fields: [statements.assignedTo],
    references: [users.id],
    relationName: "assignee",
  }),
  creator: one(users, {
    fields: [statements.createdBy],
    references: [users.id],
    relationName: "creator",
  }),
  reviewer: one(users, {
    fields: [statements.reviewedBy],
    references: [users.id],
    relationName: "reviewer",
  }),
}));

// Insert schemas
export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertProjectSchema = createInsertSchema(projects).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertStatementSchema = createInsertSchema(statements).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const updateStatementSchema = createInsertSchema(statements).omit({
  id: true,
  createdAt: true,
  projectId: true,
  createdBy: true,
}).partial();

// Types
export type UpsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
export type InsertProject = z.infer<typeof insertProjectSchema>;
export type Project = typeof projects.$inferSelect;
export type InsertStatement = z.infer<typeof insertStatementSchema>;
export type UpdateStatement = z.infer<typeof updateStatementSchema>;
export type Statement = typeof statements.$inferSelect;

// Extended types with relations
export type ProjectWithStats = Project & {
  activeTestsCount: number;
  creator: User;
};

export type StatementWithRelations = Statement & {
  project: Project;
  assignee?: User;
  creator: User;
  reviewer?: User;
};
