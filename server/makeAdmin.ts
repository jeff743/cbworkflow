
#!/usr/bin/env node

import { DatabaseStorage } from "./storage";
import { db } from "./db";

async function makeUserSuperAdmin() {
  const email = process.argv[2];
  
  if (!email) {
    console.error("Usage: npm run make-super-admin <email>");
    process.exit(1);
  }
  
  // Initialize storage with direct database connection
  const storage = new DatabaseStorage();
  
  try {
    console.log(`🔍 Looking up user with email: ${email}`);
    console.log(`📊 Database URL configured: ${process.env.DATABASE_URL ? 'Yes' : 'No'}`);
    
    // Test database connection first
    try {
      await db.$client.query('SELECT 1');
      console.log(`✅ Database connection successful`);
    } catch (dbError) {
      console.error(`❌ Database connection failed:`, dbError);
      process.exit(1);
    }
    
    // Get user by email
    const user = await storage.getUserByEmail(email);
    
    if (!user) {
      console.error(`❌ User not found with email: ${email}`);
      console.log("📝 Make sure the user has logged into the app at least once.");
      console.log("🔍 This creates their user record in the database.");
      process.exit(1);
    }
    
    console.log(`✅ Found user: ${user.firstName} ${user.lastName} (${user.email})`);
    console.log(`📋 Current role: ${user.role}`);
    console.log(`🆔 User ID: ${user.id}`);
    
    if (user.role === 'super_admin') {
      console.log("✅ User is already a super admin!");
      process.exit(0);
    }
    
    // Update role to super_admin
    console.log(`🔄 Updating role to super_admin...`);
    const updatedUser = await storage.updateUserRole(user.id, 'super_admin');
    
    if (updatedUser) {
      console.log(`🎉 Successfully promoted ${email} to super admin!`);
      console.log(`✅ New role: ${updatedUser.role}`);
    } else {
      console.error(`❌ Failed to update user role for ${email}`);
      process.exit(1);
    }
    
  } catch (error) {
    console.error(`❌ Error promoting user to super admin:`);
    console.error(`📝 Error details:`, error);
    if (error instanceof Error) {
      console.error(`📄 Error message: ${error.message}`);
      console.error(`📍 Error stack: ${error.stack}`);
    }
    process.exit(1);
  } finally {
    // Ensure database connection is closed
    try {
      await db.$client.end();
      console.log(`🔌 Database connection closed`);
    } catch (closeError) {
      console.warn(`⚠️ Warning: Failed to close database connection:`, closeError);
    }
  }
  
  process.exit(0);
}

makeUserSuperAdmin();
