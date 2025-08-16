import {
  users,
  projects,
  statements,
  type User,
  type UpsertUser,
  type Project,
  type InsertProject,
  type Statement,
  type InsertStatement,
  type UpdateStatement,
  type ProjectWithStats,
  type StatementWithRelations,
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, count, and } from "drizzle-orm";
import { logDatabase, logError } from "./logger";

export interface IStorage {
  // User operations (required for Replit Auth)
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;
  
  // Project operations
  getProjects(userId: string): Promise<ProjectWithStats[]>;
  getProject(id: string): Promise<Project | undefined>;
  createProject(project: InsertProject): Promise<Project>;
  
  // Statement operations
  getAllStatements(): Promise<StatementWithRelations[]>;
  getStatements(projectId: string, status?: string): Promise<StatementWithRelations[]>;
  getStatement(id: string): Promise<StatementWithRelations | undefined>;
  createStatement(statement: InsertStatement): Promise<Statement>;
  updateStatement(id: string, updates: UpdateStatement): Promise<Statement>;
  deleteStatement(id: string): Promise<void>;
  getStatementsByBatchId(testBatchId: string): Promise<StatementWithRelations[]>;
  deleteStatementsByBatchId(testBatchId: string): Promise<number>;
  
  // Dashboard stats
  getUserStatements(userId: string): Promise<StatementWithRelations[]>;
  getReviewStatements(userId: string): Promise<StatementWithRelations[]>;
  
  // User management (for role management)
  getAllUsers(): Promise<User[]>;
  updateUserRole(userId: string, role: string): Promise<User | undefined>;
}

export class DatabaseStorage implements IStorage {
  // User operations
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    try {
      logDatabase(`Looking up user by email: ${email}`, 'getUserByEmail');
      const [user] = await db.select().from(users).where(eq(users.email, email));
      logDatabase(`User found by email: ${user ? 'yes' : 'no'} - ${user?.id || 'no id'}`, 'getUserByEmail');
      return user;
    } catch (error) {
      logError(`Failed to get user by email: ${email}`, 'database', error as Error);
      throw error;
    }
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    try {
      logDatabase(`Upserting user: ${userData.email}`, 'upsertUser');
      const [user] = await db
        .insert(users)
        .values(userData)
        .onConflictDoUpdate({
          target: users.email,
          set: {
            ...userData,
            updatedAt: new Date(),
          },
        })
        .returning();
      logDatabase(`User upserted successfully: ${user.email}`, 'upsertUser');
      return user;
    } catch (error) {
      logError(`Failed to upsert user: ${userData.email}`, 'database', error as Error);
      throw error;
    }
  }

  // Project operations
  async getProjects(userId: string): Promise<ProjectWithStats[]> {
    const projectsWithStats = await db
      .select({
        id: projects.id,
        name: projects.name,
        description: projects.description,
        clientName: projects.clientName,
        status: projects.status,
        createdBy: projects.createdBy,
        createdAt: projects.createdAt,
        updatedAt: projects.updatedAt,
        activeTestsCount: count(statements.id),
        creator: {
          id: users.id,
          email: users.email,
          firstName: users.firstName,
          lastName: users.lastName,
          profileImageUrl: users.profileImageUrl,
          role: users.role,
          createdAt: users.createdAt,
          updatedAt: users.updatedAt,
        },
      })
      .from(projects)
      .leftJoin(users, eq(projects.createdBy, users.id))
      .leftJoin(statements, and(
        eq(statements.projectId, projects.id),
        eq(statements.status, "approved")
      ))
      .groupBy(projects.id, users.id)
      .orderBy(desc(projects.updatedAt));

    return projectsWithStats.map(p => ({
      ...p,
      creator: p.creator || { 
        id: '', email: null, firstName: null, lastName: null, 
        profileImageUrl: null, role: 'user', createdAt: null, updatedAt: null 
      }
    }));
  }

  async getProject(id: string): Promise<Project | undefined> {
    const [project] = await db.select().from(projects).where(eq(projects.id, id));
    return project;
  }

  async createProject(project: InsertProject): Promise<Project> {
    try {
      logDatabase(`Creating project: ${project.name}`, 'createProject');
      const [newProject] = await db.insert(projects).values(project).returning();
      logDatabase(`Project created successfully: ${newProject.name} (ID: ${newProject.id})`, 'createProject');
      return newProject;
    } catch (error) {
      logError(`Failed to create project: ${project.name}`, 'database', error as Error);
      throw error;
    }
  }

  // Statement operations
  async getStatements(projectId: string, status?: string): Promise<StatementWithRelations[]> {
    const whereCondition = status
      ? and(eq(statements.projectId, projectId), eq(statements.status, status))
      : eq(statements.projectId, projectId);

    const results = await db
      .select({
        id: statements.id,
        projectId: statements.projectId,
        testBatchId: statements.testBatchId,
        heading: statements.heading,
        content: statements.content,
        status: statements.status,
        priority: statements.priority,
        dueDate: statements.dueDate,
        assignedTo: statements.assignedTo,
        createdBy: statements.createdBy,
        reviewedBy: statements.reviewedBy,
        reviewNotes: statements.reviewNotes,
        headingFontSize: statements.headingFontSize,
        statementFontSize: statements.statementFontSize,
        textAlignment: statements.textAlignment,
        backgroundColor: statements.backgroundColor,
        backgroundImageUrl: statements.backgroundImageUrl,
        colorblockImageUrl: statements.colorblockImageUrl,
        createdAt: statements.createdAt,
        updatedAt: statements.updatedAt,
        project: {
          id: projects.id,
          name: projects.name,
          description: projects.description,
          clientName: projects.clientName,
          status: projects.status,
          createdBy: projects.createdBy,
          createdAt: projects.createdAt,
          updatedAt: projects.updatedAt,
        },
        creator: {
          id: users.id,
          email: users.email,
          firstName: users.firstName,
          lastName: users.lastName,
          profileImageUrl: users.profileImageUrl,
          role: users.role,
          createdAt: users.createdAt,
          updatedAt: users.updatedAt,
        },
      })
      .from(statements)
      .innerJoin(projects, eq(statements.projectId, projects.id))
      .innerJoin(users, eq(statements.createdBy, users.id))
      .where(whereCondition)
      .orderBy(desc(statements.updatedAt));

    // Add assignee and reviewer separately to avoid complex joins
    const statementsWithRelations: StatementWithRelations[] = [];
    for (const result of results) {
      let assignee: User | undefined;
      let reviewer: User | undefined;

      if (result.assignedTo) {
        assignee = await this.getUser(result.assignedTo);
      }
      if (result.reviewedBy) {
        reviewer = await this.getUser(result.reviewedBy);
      }

      statementsWithRelations.push({
        ...result,
        assignee,
        reviewer,
      });
    }

    return statementsWithRelations;
  }

  async getAllStatements(): Promise<StatementWithRelations[]> {
    const results = await db
      .select({
        id: statements.id,
        projectId: statements.projectId,
        testBatchId: statements.testBatchId,
        heading: statements.heading,
        content: statements.content,
        status: statements.status,
        priority: statements.priority,
        dueDate: statements.dueDate,
        assignedTo: statements.assignedTo,
        createdBy: statements.createdBy,
        reviewedBy: statements.reviewedBy,
        reviewNotes: statements.reviewNotes,
        headingFontSize: statements.headingFontSize,
        statementFontSize: statements.statementFontSize,
        textAlignment: statements.textAlignment,
        backgroundColor: statements.backgroundColor,
        backgroundImageUrl: statements.backgroundImageUrl,
        colorblockImageUrl: statements.colorblockImageUrl,
        createdAt: statements.createdAt,
        updatedAt: statements.updatedAt,
        project: {
          id: projects.id,
          name: projects.name,
          description: projects.description,
          clientName: projects.clientName,
          status: projects.status,
          createdBy: projects.createdBy,
          createdAt: projects.createdAt,
          updatedAt: projects.updatedAt,
        },
        creator: {
          id: users.id,
          email: users.email,
          firstName: users.firstName,
          lastName: users.lastName,
          profileImageUrl: users.profileImageUrl,
          role: users.role,
          createdAt: users.createdAt,
          updatedAt: users.updatedAt,
        },
      })
      .from(statements)
      .innerJoin(projects, eq(statements.projectId, projects.id))
      .innerJoin(users, eq(statements.createdBy, users.id))
      .orderBy(desc(statements.updatedAt));

    // Add assignee and reviewer separately
    const statementsWithRelations: StatementWithRelations[] = [];
    for (const result of results) {
      let assignee: User | undefined;
      let reviewer: User | undefined;

      if (result.assignedTo) {
        assignee = await this.getUser(result.assignedTo);
      }
      if (result.reviewedBy) {
        reviewer = await this.getUser(result.reviewedBy);
      }

      statementsWithRelations.push({
        ...result,
        assignee,
        reviewer,
      });
    }

    return statementsWithRelations;
  }

  async getStatement(id: string): Promise<StatementWithRelations | undefined> {
    const [result] = await db
      .select({
        id: statements.id,
        projectId: statements.projectId,
        testBatchId: statements.testBatchId,
        heading: statements.heading,
        content: statements.content,
        status: statements.status,
        priority: statements.priority,
        dueDate: statements.dueDate,
        assignedTo: statements.assignedTo,
        createdBy: statements.createdBy,
        reviewedBy: statements.reviewedBy,
        reviewNotes: statements.reviewNotes,
        headingFontSize: statements.headingFontSize,
        statementFontSize: statements.statementFontSize,
        textAlignment: statements.textAlignment,
        backgroundColor: statements.backgroundColor,
        backgroundImageUrl: statements.backgroundImageUrl,
        colorblockImageUrl: statements.colorblockImageUrl,
        createdAt: statements.createdAt,
        updatedAt: statements.updatedAt,
        project: {
          id: projects.id,
          name: projects.name,
          description: projects.description,
          clientName: projects.clientName,
          status: projects.status,
          createdBy: projects.createdBy,
          createdAt: projects.createdAt,
          updatedAt: projects.updatedAt,
        },
        creator: {
          id: users.id,
          email: users.email,
          firstName: users.firstName,
          lastName: users.lastName,
          profileImageUrl: users.profileImageUrl,
          role: users.role,
          createdAt: users.createdAt,
          updatedAt: users.updatedAt,
        },
      })
      .from(statements)
      .innerJoin(projects, eq(statements.projectId, projects.id))
      .innerJoin(users, eq(statements.createdBy, users.id))
      .where(eq(statements.id, id));

    if (!result) return undefined;

    let assignee: User | undefined;
    let reviewer: User | undefined;

    if (result.assignedTo) {
      assignee = await this.getUser(result.assignedTo);
    }
    if (result.reviewedBy) {
      reviewer = await this.getUser(result.reviewedBy);
    }

    return {
      ...result,
      assignee,
      reviewer,
    };
  }

  async createStatement(statement: InsertStatement): Promise<Statement> {
    try {
      logDatabase(`Creating statement for project: ${statement.projectId}`, 'createStatement');
      const [newStatement] = await db.insert(statements).values(statement).returning();
      logDatabase(`Statement created successfully: ${newStatement.id}`, 'createStatement');
      return newStatement;
    } catch (error) {
      logError(`Failed to create statement for project: ${statement.projectId}`, 'database', error as Error);
      throw error;
    }
  }

  async updateStatement(id: string, updates: UpdateStatement): Promise<Statement> {
    try {
      logDatabase(`Updating statement: ${id}`, 'updateStatement');
      const [updatedStatement] = await db
        .update(statements)
        .set({ ...updates, updatedAt: new Date() })
        .where(eq(statements.id, id))
        .returning();
      logDatabase(`Statement updated successfully: ${updatedStatement.id}`, 'updateStatement');
      return updatedStatement;
    } catch (error) {
      logError(`Failed to update statement: ${id}`, 'database', error as Error);
      throw error;
    }
  }

  async deleteStatement(id: string): Promise<void> {
    await db.delete(statements).where(eq(statements.id, id));
  }

  async getStatementsByBatchId(testBatchId: string): Promise<StatementWithRelations[]> {
    const results = await db
      .select({
        id: statements.id,
        projectId: statements.projectId,
        testBatchId: statements.testBatchId,
        heading: statements.heading,
        content: statements.content,
        status: statements.status,
        priority: statements.priority,
        dueDate: statements.dueDate,
        assignedTo: statements.assignedTo,
        createdBy: statements.createdBy,
        reviewedBy: statements.reviewedBy,
        reviewNotes: statements.reviewNotes,
        headingFontSize: statements.headingFontSize,
        statementFontSize: statements.statementFontSize,
        textAlignment: statements.textAlignment,
        backgroundColor: statements.backgroundColor,
        backgroundImageUrl: statements.backgroundImageUrl,
        colorblockImageUrl: statements.colorblockImageUrl,
        createdAt: statements.createdAt,
        updatedAt: statements.updatedAt,
        project: {
          id: projects.id,
          name: projects.name,
          description: projects.description,
          clientName: projects.clientName,
          status: projects.status,
          createdBy: projects.createdBy,
          createdAt: projects.createdAt,
          updatedAt: projects.updatedAt,
        },
        creator: {
          id: users.id,
          email: users.email,
          firstName: users.firstName,
          lastName: users.lastName,
          profileImageUrl: users.profileImageUrl,
          role: users.role,
          createdAt: users.createdAt,
        }
      })
      .from(statements)
      .leftJoin(projects, eq(statements.projectId, projects.id))
      .leftJoin(users, eq(statements.createdBy, users.id))
      .where(eq(statements.testBatchId, testBatchId))
      .orderBy(desc(statements.createdAt));

    return results.map(result => ({ 
      ...result, 
      assignee: undefined, 
      reviewer: undefined,
      project: result.project || { 
        id: '', 
        name: 'Unknown Project', 
        description: null, 
        clientName: null, 
        status: 'active', 
        createdBy: '', 
        createdAt: null, 
        updatedAt: null 
      }
    }));
  }

  async deleteStatementsByBatchId(testBatchId: string): Promise<number> {
    const result = await db.delete(statements).where(eq(statements.testBatchId, testBatchId));
    // @ts-ignore - Drizzle delete returns metadata with rowCount/affected rows
    return result.rowCount || result.changes || 0;
  }

  // Dashboard stats
  async getUserStatements(userId: string): Promise<StatementWithRelations[]> {
    const results = await db
      .select({
        id: statements.id,
        projectId: statements.projectId,
        testBatchId: statements.testBatchId,
        heading: statements.heading,
        content: statements.content,
        status: statements.status,
        priority: statements.priority,
        dueDate: statements.dueDate,
        assignedTo: statements.assignedTo,
        createdBy: statements.createdBy,
        reviewedBy: statements.reviewedBy,
        reviewNotes: statements.reviewNotes,
        headingFontSize: statements.headingFontSize,
        statementFontSize: statements.statementFontSize,
        textAlignment: statements.textAlignment,
        backgroundColor: statements.backgroundColor,
        backgroundImageUrl: statements.backgroundImageUrl,
        colorblockImageUrl: statements.colorblockImageUrl,
        createdAt: statements.createdAt,
        updatedAt: statements.updatedAt,
        project: {
          id: projects.id,
          name: projects.name,
          description: projects.description,
          clientName: projects.clientName,
          status: projects.status,
          createdBy: projects.createdBy,
          createdAt: projects.createdAt,
          updatedAt: projects.updatedAt,
        },
        creator: {
          id: users.id,
          email: users.email,
          firstName: users.firstName,
          lastName: users.lastName,
          profileImageUrl: users.profileImageUrl,
          role: users.role,
          createdAt: users.createdAt,
          updatedAt: users.updatedAt,
        },
      })
      .from(statements)
      .innerJoin(projects, eq(statements.projectId, projects.id))
      .innerJoin(users, eq(statements.createdBy, users.id))
      .where(eq(statements.assignedTo, userId))
      .orderBy(desc(statements.updatedAt));

    return results.map(result => ({ ...result, assignee: undefined, reviewer: undefined }));
  }

  async getReviewStatements(userId: string): Promise<StatementWithRelations[]> {
    const results = await db
      .select({
        id: statements.id,
        projectId: statements.projectId,
        testBatchId: statements.testBatchId,
        heading: statements.heading,
        content: statements.content,
        status: statements.status,
        priority: statements.priority,
        dueDate: statements.dueDate,
        assignedTo: statements.assignedTo,
        createdBy: statements.createdBy,
        reviewedBy: statements.reviewedBy,
        reviewNotes: statements.reviewNotes,
        headingFontSize: statements.headingFontSize,
        statementFontSize: statements.statementFontSize,
        textAlignment: statements.textAlignment,
        backgroundColor: statements.backgroundColor,
        backgroundImageUrl: statements.backgroundImageUrl,
        colorblockImageUrl: statements.colorblockImageUrl,
        createdAt: statements.createdAt,
        updatedAt: statements.updatedAt,
        project: {
          id: projects.id,
          name: projects.name,
          description: projects.description,
          clientName: projects.clientName,
          status: projects.status,
          createdBy: projects.createdBy,
          createdAt: projects.createdAt,
          updatedAt: projects.updatedAt,
        },
        creator: {
          id: users.id,
          email: users.email,
          firstName: users.firstName,
          lastName: users.lastName,
          profileImageUrl: users.profileImageUrl,
          role: users.role,
          createdAt: users.createdAt,
          updatedAt: users.updatedAt,
        },
      })
      .from(statements)
      .innerJoin(projects, eq(statements.projectId, projects.id))
      .innerJoin(users, eq(statements.createdBy, users.id))
      .where(eq(statements.status, "under_review"))
      .orderBy(desc(statements.updatedAt));

    return results.map(result => ({ ...result, assignee: undefined, reviewer: undefined }));
  }

  // User management methods
  async getAllUsers(): Promise<User[]> {
    try {
      logDatabase('Fetching all users', 'getAllUsers');
      const allUsers = await db.select().from(users).orderBy(users.createdAt);
      logDatabase(`Found ${allUsers.length} users`, 'getAllUsers');
      return allUsers;
    } catch (error) {
      logError('Failed to fetch all users', 'database', error as Error);
      throw error;
    }
  }

  async updateUserRole(userId: string, role: string): Promise<User | undefined> {
    try {
      logDatabase(`Updating user role: ${userId} -> ${role}`, 'updateUserRole');
      const [updatedUser] = await db
        .update(users)
        .set({ 
          role,
          updatedAt: new Date() 
        })
        .where(eq(users.id, userId))
        .returning();
      
      if (updatedUser) {
        logDatabase(`User role updated successfully: ${updatedUser.email} -> ${role}`, 'updateUserRole');
      }
      return updatedUser;
    } catch (error) {
      logError(`Failed to update user role: ${userId}`, 'database', error as Error);
      throw error;
    }
  }
}

export const storage = new DatabaseStorage();
