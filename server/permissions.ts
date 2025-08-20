import type { User } from "@shared/schema";
import { logAuth, logError } from "./logger";

export enum UserRole {
  SUPER_ADMIN = 'super_admin',
  GROWTH_STRATEGIST = 'growth_strategist', 
  CREATIVE_STRATEGIST = 'creative_strategist'
}

export enum Permission {
  // Project permissions
  CREATE_PROJECT = 'create_project',
  DELETE_PROJECT = 'delete_project',
  VIEW_PROJECTS = 'view_projects',
  
  // Member/User permissions  
  ADD_MEMBERS = 'add_members',
  DELETE_MEMBERS = 'delete_members',
  MANAGE_USER_ROLES = 'manage_user_roles',
  
  // Task/Statement permissions
  CREATE_TASK = 'create_task',
  DELETE_TASK = 'delete_task',
  VIEW_TASKS = 'view_tasks',
  REVIEW_TASKS = 'review_tasks',
  
  // Dashboard permissions
  VIEW_DASHBOARD = 'view_dashboard'
}

// Role-based permission mapping
const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  [UserRole.SUPER_ADMIN]: [
    // Super admin has ALL permissions
    Permission.CREATE_PROJECT,
    Permission.DELETE_PROJECT,
    Permission.VIEW_PROJECTS,
    Permission.ADD_MEMBERS,
    Permission.DELETE_MEMBERS,
    Permission.MANAGE_USER_ROLES,
    Permission.CREATE_TASK,
    Permission.DELETE_TASK,
    Permission.VIEW_TASKS,
    Permission.REVIEW_TASKS,
    Permission.VIEW_DASHBOARD
  ],
  
  [UserRole.GROWTH_STRATEGIST]: [
    // Growth strategist: projects + tasks + user management
    Permission.CREATE_PROJECT,
    Permission.DELETE_PROJECT,
    Permission.VIEW_PROJECTS,
    Permission.ADD_MEMBERS,
    Permission.MANAGE_USER_ROLES,
    Permission.CREATE_TASK,
    Permission.DELETE_TASK,
    Permission.VIEW_TASKS,
    Permission.REVIEW_TASKS,
    Permission.VIEW_DASHBOARD
  ],
  
  [UserRole.CREATIVE_STRATEGIST]: [
    // Creative strategist: only tasks
    Permission.CREATE_TASK,
    Permission.DELETE_TASK,
    Permission.VIEW_TASKS,
    Permission.VIEW_PROJECTS, // Need to see projects to work on tasks
    Permission.VIEW_DASHBOARD
  ]
};

export function hasPermission(user: User | null | undefined, permission: Permission): boolean {
  if (!user || !user.role) {
    logAuth(`Permission check failed - no user or role`, user?.id);
    return false;
  }

  const userRole = user.role as UserRole;
  const rolePermissions = ROLE_PERMISSIONS[userRole];
  
  if (!rolePermissions) {
    logAuth(`Permission check failed - invalid role: ${userRole}`, user.id);
    return false;
  }

  const hasAccess = rolePermissions.includes(permission);
  logAuth(`Permission check: ${permission} for role ${userRole} = ${hasAccess}`, user.id);
  
  return hasAccess;
}

export function requirePermission(user: User | null | undefined, permission: Permission): void {
  if (!hasPermission(user, permission)) {
    const error = new Error(`Insufficient permissions: ${permission} required`);
    logError(`Permission denied: ${permission}`, 'auth', error);
    throw error;
  }
}

// Helper functions for common permission checks
export function canManageProjects(user: User | null | undefined): boolean {
  return hasPermission(user, Permission.CREATE_PROJECT);
}

export function canManageMembers(user: User | null | undefined): boolean {
  return hasPermission(user, Permission.ADD_MEMBERS);
}

export function canManageTasks(user: User | null | undefined): boolean {
  return hasPermission(user, Permission.CREATE_TASK);
}

export function isAdmin(user: User | null | undefined): boolean {
  return user?.role === UserRole.SUPER_ADMIN;
}

export function getUserRoleDisplayName(role: string): string {
  switch (role) {
    case UserRole.SUPER_ADMIN:
      return 'Super Admin';
    case UserRole.GROWTH_STRATEGIST:
      return 'Growth Strategist';
    case UserRole.CREATIVE_STRATEGIST:
      return 'Creative Strategist';
    default:
      return 'Unknown Role';
  }
}

// Middleware factory for Express routes
export function requirePermissionMiddleware(permission: Permission) {
  return async (req: any, res: any, next: any) => {
    try {
      const userEmail = req.user?.claims?.email;
      if (!userEmail) {
        return res.status(401).json({ message: 'Authentication required' });
      }

      // This will be injected by the auth middleware
      const user = req.currentUser;
      if (!user) {
        return res.status(401).json({ message: 'User not found' });
      }

      requirePermission(user, permission);
      next();
    } catch (error) {
      res.status(403).json({ message: 'Insufficient permissions' });
    }
  };
}