import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth, isAuthenticated } from "./replitAuth";
import { ObjectStorageService } from "./objectStorage";
import { insertProjectSchema, insertStatementSchema, updateStatementSchema, type User } from "@shared/schema";
import canvas from "canvas";
import { logger } from "./logger";
import { Permission, requirePermissionMiddleware, hasPermission, getUserRoleDisplayName } from "./permissions";

const { createCanvas, loadImage, registerFont } = canvas;

export async function registerRoutes(app: Express): Promise<Server> {
  // Auth middleware
  await setupAuth(app);
  
  // Inject current user middleware for permission checking
  app.use('/api', isAuthenticated, async (req: any, res: any, next: any) => {
    try {
      const userEmail = req.user?.claims?.email;
      if (userEmail) {
        req.currentUser = await storage.getUserByEmail(userEmail);
      }
      next();
    } catch (error) {
      logger.error('Failed to inject current user', 'middleware', error as Error);
      next();
    }
  });

  // Auth routes
  app.get('/api/auth/user', async (req: any, res) => {
    try {
      const user = req.currentUser;
      if (user) {
        res.json({
          ...user,
          roleDisplayName: getUserRoleDisplayName(user.role)
        });
      } else {
        res.status(404).json({ message: 'User not found' });
      }
    } catch (error) {
      logger.error("Error fetching user", 'auth-route', error as Error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  // Project routes  
  app.get('/api/projects', requirePermissionMiddleware(Permission.VIEW_PROJECTS), async (req: any, res) => {
    try {
      const user = req.currentUser;
      const projects = await storage.getProjects(user.id);
      res.json(projects);
    } catch (error) {
      console.error("Error fetching projects:", error);
      res.status(500).json({ message: "Failed to fetch projects" });
    }
  });

  app.get('/api/projects/:id', requirePermissionMiddleware(Permission.VIEW_PROJECTS), async (req, res) => {
    try {
      const project = await storage.getProject(req.params.id);
      if (!project) {
        return res.status(404).json({ message: "Project not found" });
      }
      res.json(project);
    } catch (error) {
      console.error("Error fetching project:", error);
      res.status(500).json({ message: "Failed to fetch project" });
    }
  });

  app.post('/api/projects', requirePermissionMiddleware(Permission.CREATE_PROJECT), async (req: any, res) => {
    try {
      const userId = req.currentUser?.id;
      if (!userId) {
        return res.status(401).json({ message: "User not found" });
      }
      
      const projectData = insertProjectSchema.parse({
        ...req.body,
        createdBy: userId,
      });
      const project = await storage.createProject(projectData);
      res.json(project);
    } catch (error) {
      console.error("Error creating project:", error);
      res.status(500).json({ message: "Failed to create project" });
    }
  });

  // Statement routes
  app.get('/api/projects/:projectId/statements', requirePermissionMiddleware(Permission.VIEW_TASKS), async (req, res) => {
    try {
      const { status } = req.query;
      const statements = await storage.getStatements(
        req.params.projectId,
        status as string | undefined
      );
      res.json(statements);
    } catch (error) {
      console.error("Error fetching statements:", error);
      res.status(500).json({ message: "Failed to fetch statements" });
    }
  });

  app.get('/api/statements/:id', isAuthenticated, async (req, res) => {
    try {
      const statement = await storage.getStatement(req.params.id);
      if (!statement) {
        return res.status(404).json({ message: "Statement not found" });
      }
      res.json(statement);
    } catch (error) {
      console.error("Error fetching statement:", error);
      res.status(500).json({ message: "Failed to fetch statement" });
    }
  });

  app.post('/api/statements', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.currentUser?.id;
      if (!userId) {
        return res.status(401).json({ message: "User not found" });
      }
      
      console.log('🔥 SERVER - Received statement creation request:', {
        testBatchId: req.body.testBatchId,
        heading: req.body.heading,
        projectId: req.body.projectId,
        userId: userId
      });
      
      // Convert dueDate string to Date object if provided
      const requestData = {
        ...req.body,
        createdBy: userId,
        dueDate: req.body.dueDate ? new Date(req.body.dueDate) : undefined,
      };
      
      console.log('🔥 SERVER - Prepared request data testBatchId:', requestData.testBatchId);
      
      const statementData = insertStatementSchema.parse(requestData);
      console.log('🔥 SERVER - After schema parse testBatchId:', statementData.testBatchId);
      
      const statement = await storage.createStatement(statementData);
      console.log('🔥 SERVER - Created statement with testBatchId:', statement.testBatchId, 'ID:', statement.id);

      // TODO: Add Slack notification for new statement assignment

      res.json(statement);
    } catch (error) {
      console.error("🔥 SERVER - Error creating statement:", error);
      res.status(500).json({ message: "Failed to create statement" });
    }
  });

  // Batch statement creation endpoint
  app.post('/api/statements/batch', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.currentUser?.id;
      if (!userId) {
        return res.status(401).json({ message: "User not found" });
      }
      
      const { statements, testBatchId } = req.body;
      
      console.log('🚀 BATCH ENDPOINT - Received batch creation request:', {
        testBatchId: testBatchId,
        statementCount: statements?.length,
        userId: userId
      });
      
      if (!statements || !Array.isArray(statements) || statements.length === 0) {
        return res.status(400).json({ message: "Statements array is required" });
      }
      
      if (!testBatchId) {
        return res.status(400).json({ message: "testBatchId is required" });
      }
      
      // Ensure all statements use the same testBatchId and add server-side data
      const results = [];
      for (let i = 0; i < statements.length; i++) {
        const stmt = statements[i];
        
        const statementData = {
          ...stmt,
          testBatchId, // Force same batch ID from request body
          createdBy: userId,
          dueDate: stmt.dueDate ? new Date(stmt.dueDate) : undefined,
        };
        
        console.log(`🚀 BATCH ENDPOINT - Processing statement ${i + 1}/${statements.length}:`, {
          heading: statementData.heading,
          testBatchId: statementData.testBatchId,
          batchIdMatch: statementData.testBatchId === testBatchId ? '✅' : '❌'
        });
        
        const validatedData = insertStatementSchema.parse(statementData);
        const result = await storage.createStatement(validatedData);
        
        console.log(`🚀 BATCH ENDPOINT - Created statement ${i + 1}:`, {
          id: result.id,
          testBatchId: result.testBatchId,
          batchIdMatch: result.testBatchId === testBatchId ? '✅' : '❌'
        });
        
        results.push(result);
      }
      
      console.log('🚀 BATCH ENDPOINT - Batch creation complete:', {
        originalBatchId: testBatchId,
        createdCount: results.length,
        allMatch: results.every(r => r.testBatchId === testBatchId) ? '✅ SUCCESS' : '❌ FAILURE',
        resultBatchIds: results.map(r => r.testBatchId)
      });
      
      res.json(results);
    } catch (error) {
      console.error('🚀 BATCH ENDPOINT - Error creating batch statements:', error);
      res.status(500).json({ message: "Failed to create batch statements" });
    }
  });

  app.put('/api/statements/:id', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.currentUser?.id;
      if (!userId) {
        return res.status(401).json({ message: "User not found" });
      }
      const updates = updateStatementSchema.parse(req.body);
      
      // If status is being changed to under_review, generate colorblock image
      if (updates.status === 'under_review') {
        const statement = await storage.getStatement(req.params.id);
        if (statement) {
          try {
            const colorblockUrl = await generateColorblockImage(statement);
            updates.colorblockImageUrl = colorblockUrl;
          } catch (imageError) {
            console.error("Error generating colorblock image:", imageError);
          }
        }
      }

      const statement = await storage.updateStatement(req.params.id, updates);

      // TODO: Add Slack notification for status changes

      res.json(statement);
    } catch (error) {
      console.error("Error updating statement:", error);
      res.status(500).json({ message: "Failed to update statement" });
    }
  });

  app.delete('/api/statements/:id', isAuthenticated, async (req, res) => {
    try {
      await storage.deleteStatement(req.params.id);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting statement:", error);
      res.status(500).json({ message: "Failed to delete statement" });
    }
  });

  // Delete test batch (all statements with same testBatchId)
  app.delete('/api/test-batches/:testBatchId', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.currentUser?.id;
      if (!userId) {
        return res.status(401).json({ message: "User not found" });
      }
      
      const testBatchId = req.params.testBatchId;
      console.log(`🗑️ DELETE BATCH - Starting deletion for testBatchId: ${testBatchId}`);
      
      // Get all statements in the batch first for logging
      const statementsInBatch = await storage.getStatementsByBatchId(testBatchId);
      console.log(`🗑️ DELETE BATCH - Found ${statementsInBatch.length} statements to delete`);
      
      // Delete all statements with this testBatchId
      const deletedCount = await storage.deleteStatementsByBatchId(testBatchId);
      
      console.log(`🗑️ DELETE BATCH - Successfully deleted ${deletedCount} statements`);
      
      res.json({ 
        success: true, 
        deletedCount,
        testBatchId 
      });
    } catch (error) {
      console.error("Error deleting test batch:", error);
      res.status(500).json({ message: "Failed to delete test batch" });
    }
  });

  // Get all statements
  app.get('/api/statements', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.currentUser?.id;
      if (!userId) {
        return res.status(401).json({ message: "User not found" });
      }
      const statements = await storage.getAllStatements();
      res.json(statements);
    } catch (error) {
      console.error("Error fetching all statements:", error);
      res.status(500).json({ message: "Failed to fetch statements" });
    }
  });

  // Dashboard routes
  app.get('/api/dashboard/my-statements', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.currentUser?.id;
      if (!userId) {
        return res.status(401).json({ message: "User not found" });
      }
      const statements = await storage.getUserStatements(userId);
      res.json(statements);
    } catch (error) {
      console.error("Error fetching user statements:", error);
      res.status(500).json({ message: "Failed to fetch statements" });
    }
  });

  app.get('/api/dashboard/review-statements', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.currentUser?.id;
      if (!userId) {
        return res.status(401).json({ message: "User not found" });
      }
      const statements = await storage.getReviewStatements(userId);
      res.json(statements);
    } catch (error) {
      console.error("Error fetching review statements:", error);
      res.status(500).json({ message: "Failed to fetch review statements" });
    }
  });

  // Object storage routes for background images
  app.post("/api/objects/upload", isAuthenticated, async (req, res) => {
    try {
      const objectStorageService = new ObjectStorageService();
      const uploadURL = await objectStorageService.getObjectEntityUploadURL();
      res.json({ uploadURL });
    } catch (error) {
      console.error("Error getting upload URL:", error);
      res.status(500).json({ error: "Failed to get upload URL" });
    }
  });

  app.put("/api/background-images", isAuthenticated, async (req: any, res) => {
    if (!req.body.backgroundImageURL) {
      return res.status(400).json({ error: "backgroundImageURL is required" });
    }

    const userId = req.currentUser?.id;
    if (!userId) {
      return res.status(401).json({ error: "User not found" });
    }

    try {
      const objectStorageService = new ObjectStorageService();
      const objectPath = await objectStorageService.trySetObjectEntityAclPolicy(
        req.body.backgroundImageURL,
        {
          owner: userId,
          visibility: "public",
        },
      );

      res.status(200).json({
        objectPath: objectPath,
      });
    } catch (error) {
      console.error("Error setting background image:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Export approved colorblocks
  app.get('/api/projects/:projectId/export', isAuthenticated, async (req, res) => {
    try {
      const statements = await storage.getStatements(req.params.projectId, 'approved');
      const approvedStatements = statements.filter(s => s.colorblockImageUrl);
      
      if (approvedStatements.length === 0) {
        return res.status(404).json({ message: "No approved colorblocks found" });
      }

      // In a real implementation, you would create a zip file with all images
      // For now, return the list of image URLs
      res.json({
        count: approvedStatements.length,
        images: approvedStatements.map(s => ({
          id: s.id,
          heading: s.heading,
          imageUrl: s.colorblockImageUrl,
        }))
      });
    } catch (error) {
      console.error("Error exporting colorblocks:", error);
      res.status(500).json({ message: "Failed to export colorblocks" });
    }
  });

  // Role management routes (Super Admin only)
  app.get('/api/users', requirePermissionMiddleware(Permission.ADD_MEMBERS), async (req: any, res) => {
    try {
      // Get all users with their roles
      const users = await storage.getAllUsers();
      res.json(users.map((user: User) => ({
        ...user,
        roleDisplayName: getUserRoleDisplayName(user.role)
      })));
    } catch (error) {
      logger.error('Failed to fetch users', 'api', error as Error);
      res.status(500).json({ message: 'Failed to fetch users' });
    }
  });

  app.patch('/api/users/:id/role', requirePermissionMiddleware(Permission.MANAGE_USER_ROLES), async (req: any, res) => {
    try {
      const { role } = req.body;
      const validRoles = ['super_admin', 'growth_strategist', 'creative_strategist'];
      
      if (!validRoles.includes(role)) {
        return res.status(400).json({ message: 'Invalid role' });
      }

      const updatedUser = await storage.updateUserRole(req.params.id, role);
      if (!updatedUser) {
        return res.status(404).json({ message: 'User not found' });
      }

      logger.info(`Role updated: ${updatedUser.email} -> ${role}`, 'role-management');
      res.json({
        ...updatedUser,
        roleDisplayName: getUserRoleDisplayName(updatedUser.role)
      });
    } catch (error) {
      logger.error('Failed to update user role', 'api', error as Error);
      res.status(500).json({ message: 'Failed to update user role' });
    }
  });

  // Logs route for debugging
  app.get('/api/logs', requirePermissionMiddleware(Permission.MANAGE_USER_ROLES), (req: any, res) => {
    try {
      const logType = req.query.type || 'combined';
      const lines = parseInt(req.query.lines as string) || 100;
      
      // Only allow specific log types for security
      const allowedLogTypes = ['combined', 'error', 'warn', 'info', 'debug', 'access', 'auth', 'database'];
      if (!allowedLogTypes.includes(logType)) {
        return res.status(400).json({ message: 'Invalid log type' });
      }

      const recentLogs = logger.getRecentLogs(logType, lines);
      const logFiles = logger.getLogFiles();
      
      res.json({
        logType,
        lines: recentLogs.length,
        logs: recentLogs,
        availableTypes: allowedLogTypes,
        logFiles: Object.keys(logFiles)
      });
    } catch (error) {
      logger.error('Failed to retrieve logs', 'api', error as Error);
      res.status(500).json({ message: 'Failed to retrieve logs' });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}

// Generate colorblock image using Canvas
async function generateColorblockImage(statement: any): Promise<string> {
  const canvas = createCanvas(1080, 1080);
  const ctx = canvas.getContext('2d');

  // Set background
  if (statement.backgroundImageUrl) {
    try {
      const image = await loadImage(statement.backgroundImageUrl);
      ctx.drawImage(image, 0, 0, 1080, 1080);
      // Add dark overlay for text readability
      ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
      ctx.fillRect(0, 0, 1080, 1080);
    } catch (error) {
      console.error("Error loading background image:", error);
      // Fallback to solid color
      ctx.fillStyle = statement.backgroundColor || '#4CAF50';
      ctx.fillRect(0, 0, 1080, 1080);
    }
  } else {
    ctx.fillStyle = statement.backgroundColor || '#4CAF50';
    ctx.fillRect(0, 0, 1080, 1080);
  }

  // Set text properties
  ctx.fillStyle = 'white';
  ctx.textAlign = statement.textAlignment === 'left' ? 'left' : 
                statement.textAlignment === 'right' ? 'right' : 'center';

  const centerX = 540;
  const padding = 80;

  let currentY = 540; // Center vertically

  // Calculate text layout
  if (statement.heading && statement.content) {
    // Both heading and content
    currentY = 400; // Start higher to accommodate both
  }

  // Draw heading if present
  if (statement.heading) {
    ctx.font = `bold ${statement.headingFontSize || 48}px Inter, sans-serif`;
    const headingLines = wrapText(ctx, statement.heading, 1080 - (padding * 2));
    
    headingLines.forEach((line, index) => {
      const x = statement.textAlignment === 'left' ? padding :
                statement.textAlignment === 'right' ? 1080 - padding : centerX;
      ctx.fillText(line, x, currentY + (index * (statement.headingFontSize || 48) * 1.2));
    });
    
    currentY += headingLines.length * (statement.headingFontSize || 48) * 1.2 + 40;
  }

  // Draw content
  if (statement.content) {
    ctx.font = `${statement.statementFontSize || 43}px Inter, sans-serif`;
    const contentLines = wrapText(ctx, statement.content, 1080 - (padding * 2));
    
    // If no heading, center the content vertically
    if (!statement.heading) {
      const totalHeight = contentLines.length * (statement.statementFontSize || 43) * 1.2;
      currentY = (1080 - totalHeight) / 2 + (statement.statementFontSize || 43);
    }
    
    contentLines.forEach((line, index) => {
      const x = statement.textAlignment === 'left' ? padding :
                statement.textAlignment === 'right' ? 1080 - padding : centerX;
      ctx.fillText(line, x, currentY + (index * (statement.statementFontSize || 43) * 1.2));
    });
  }

  // Convert to data URL (base64)
  const dataUrl = canvas.toDataURL('image/png');
  
  // In a real implementation, you would upload this to object storage
  // For now, return the data URL
  return dataUrl;
}

// Helper function to wrap text
function wrapText(ctx: any, text: string, maxWidth: number): string[] {
  const words = text.split(' ');
  const lines: string[] = [];
  let currentLine = '';

  for (const word of words) {
    const testLine = currentLine + (currentLine ? ' ' : '') + word;
    const metrics = ctx.measureText(testLine);
    
    if (metrics.width > maxWidth && currentLine) {
      lines.push(currentLine);
      currentLine = word;
    } else {
      currentLine = testLine;
    }
  }
  
  if (currentLine) {
    lines.push(currentLine);
  }
  
  return lines;
}
