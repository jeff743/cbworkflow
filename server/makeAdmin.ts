
import { drizzle } from 'drizzle-orm/neon-serverless';
import { Pool, neonConfig } from '@neondatabase/serverless';
import { users } from '../shared/schema';
import { eq, ilike } from 'drizzle-orm';
import ws from 'ws';

// Configure WebSocket for Neon
neonConfig.webSocketConstructor = ws;

async function makeUserSuperAdmin(email: string) {
  // Validate environment
  if (!process.env.DATABASE_URL) {
    console.error('❌ DATABASE_URL environment variable is not set');
    process.exit(1);
  }

  console.log(`🔍 Starting admin script for: ${email}`);
  console.log(`🔍 Environment: ${process.env.NODE_ENV}`);
  
  // Create database connection
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const db = drizzle({ client: pool });

  try {
    // Test connection
    await pool.query('SELECT 1');
    console.log(`✅ Database connection successful`);

    // First, let's see ALL users in the database
    console.log(`\n🔍 DIAGNOSTIC: Listing all users in database...`);
    const allUsers = await db.select().from(users);
    console.log(`📊 Total users found: ${allUsers.length}`);
    
    if (allUsers.length === 0) {
      console.log(`⚠️  No users found in database at all!`);
      console.log(`💡 This suggests the user hasn't been created in the database yet`);
      console.log(`💡 Make sure the user has logged into the app and accessed a protected route`);
      process.exit(1);
    }

    // Log all users (without sensitive info)
    allUsers.forEach((user, index) => {
      const displayName = user.firstName && user.lastName 
        ? `${user.firstName} ${user.lastName}` 
        : user.email || 'No email';
      console.log(`   ${index + 1}. ${displayName} (${user.email}) - Role: ${user.role} - ID: ${user.id}`);
    });

    // Now try different ways to find the target user
    console.log(`\n🔍 DIAGNOSTIC: Searching for user with email: ${email}`);

    // Method 1: Exact match
    const [exactUser] = await db.select().from(users).where(eq(users.email, email));
    console.log(`   Exact match: ${exactUser ? 'FOUND' : 'NOT FOUND'}`);

    // Method 2: Case-insensitive search
    const [iLikeUser] = await db.select().from(users).where(ilike(users.email, email));
    console.log(`   Case-insensitive: ${iLikeUser ? 'FOUND' : 'NOT FOUND'}`);

    // Method 3: Pattern matching
    const patternUsers = await db.select().from(users).where(ilike(users.email, `%${email}%`));
    console.log(`   Pattern match: ${patternUsers.length} users found`);

    // Method 4: Check for similar emails
    const similarUsers = await db.select().from(users).where(ilike(users.email, `%pineapplerain%`));
    console.log(`   Similar emails (pineapplerain): ${similarUsers.length} users found`);
    similarUsers.forEach(user => {
      console.log(`      - ${user.email} (${user.firstName} ${user.lastName})`);
    });

    // Use the best match we found
    const targetUser = exactUser || iLikeUser || patternUsers[0] || similarUsers[0];

    if (!targetUser) {
      console.error(`\n❌ User with email '${email}' not found in database`);
      console.log(`💡 Available users:`);
      allUsers.forEach(user => {
        console.log(`   - ${user.email} (${user.firstName || 'No first name'} ${user.lastName || 'No last name'})`);
      });
      console.log(`\n💡 Troubleshooting steps:`);
      console.log(`   1. Make sure the email is exactly correct (case-sensitive)`);
      console.log(`   2. Ensure the user has logged into the app recently`);
      console.log(`   3. Check that the user accessed a protected route (not just the login page)`);
      console.log(`   4. The user creation happens via Replit Auth integration`);
      process.exit(1);
    }

    const displayName = targetUser.firstName && targetUser.lastName 
      ? `${targetUser.firstName} ${targetUser.lastName}` 
      : targetUser.email;
    
    console.log(`\n✅ Found user: ${displayName} (ID: ${targetUser.id})`);
    console.log(`📋 Current role: ${targetUser.role}`);
    console.log(`📧 Email: ${targetUser.email}`);
    console.log(`🆔 User ID: ${targetUser.id}`);

    if (targetUser.role === 'super_admin') {
      console.log('\n✅ User is already a super admin!');
      process.exit(0);
    }

    // Update user role
    console.log(`\n🔄 Updating role from '${targetUser.role}' to 'super_admin'...`);
    const [updatedUser] = await db
      .update(users)
      .set({
        role: 'super_admin',
        updatedAt: new Date()
      })
      .where(eq(users.id, targetUser.id))
      .returning();

    console.log(`\n🎉 Successfully promoted ${updatedUser.email} to super admin!`);
    console.log(`📋 New role: ${updatedUser.role}`);
    console.log(`\n💡 The user will see their new permissions when they refresh the app`);

  } catch (error) {
    console.error('\n❌ Error in admin script:', error);
    if (error instanceof Error) {
      console.error(`📄 Error message: ${error.message}`);
    }
    process.exit(1);
  } finally {
    await pool.end();
    console.log('\n🔌 Database connection closed');
  }
}

// Main execution
const email = process.argv[2];

if (!email) {
  console.error('❌ Please provide an email address');
  console.log('Usage: npm run make-super-admin <email@example.com>');
  process.exit(1);
}

makeUserSuperAdmin(email)
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Script failed:', error);
    process.exit(1);
  });
