
#!/usr/bin/env node

import { storage } from "./storage";
import { logger } from "./logger";

async function makeUserSuperAdmin() {
  const email = process.argv[2];
  
  if (!email) {
    console.error("Usage: npm run make-super-admin <email>");
    process.exit(1);
  }
  
  try {
    console.log(`Looking up user with email: ${email}`);
    
    // Get user by email
    const user = await storage.getUserByEmail(email);
    
    if (!user) {
      console.error(`❌ User not found with email: ${email}`);
      console.log("Make sure the user has logged into the app at least once.");
      process.exit(1);
    }
    
    console.log(`✅ Found user: ${user.firstName} ${user.lastName} (${user.email})`);
    console.log(`Current role: ${user.role}`);
    
    if (user.role === 'super_admin') {
      console.log("✅ User is already a super admin!");
      process.exit(0);
    }
    
    // Update role to super_admin
    const updatedUser = await storage.updateUserRole(user.id, 'super_admin');
    
    if (updatedUser) {
      console.log(`🎉 Successfully promoted ${email} to super admin!`);
      logger.info(`User promoted to super admin: ${email}`, 'admin-script');
    } else {
      console.error(`❌ Failed to update user role for ${email}`);
      process.exit(1);
    }
    
  } catch (error) {
    console.error(`❌ Error promoting user to super admin:`, error);
    process.exit(1);
  }
  
  process.exit(0);
}

makeUserSuperAdmin();
