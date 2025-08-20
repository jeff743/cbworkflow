
import { drizzle } from 'drizzle-orm/neon-serverless';
import { Pool, neonConfig } from '@neondatabase/serverless';
import { users } from '../shared/schema';
import { eq } from 'drizzle-orm';
import ws from 'ws';

// Configure WebSocket for Neon
neonConfig.webSocketConstructor = ws;

async function makeUserSuperAdmin(email: string) {
  // Validate environment
  if (!process.env.DATABASE_URL) {
    console.error('❌ DATABASE_URL environment variable is not set');
    process.exit(1);
  }

  console.log(`🔍 Connecting to database...`);
  
  // Create database connection
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const db = drizzle({ client: pool });

  try {
    // Test connection
    await pool.query('SELECT 1');
    console.log(`✅ Database connection successful`);

    // Find user
    console.log(`🔍 Looking for user with email: ${email}`);
    const [user] = await db.select().from(users).where(eq(users.email, email));

    if (!user) {
      console.error(`❌ User with email ${email} not found in database`);
      console.log('💡 Make sure the user has logged into the app at least once');
      process.exit(1);
    }

    const displayName = user.firstName && user.lastName 
      ? `${user.firstName} ${user.lastName}` 
      : user.email;
    
    console.log(`✅ Found user: ${displayName} (ID: ${user.id})`);
    console.log(`📋 Current role: ${user.role}`);

    if (user.role === 'super_admin') {
      console.log('✅ User is already a super admin!');
      process.exit(0);
    }

    // Update user role
    console.log(`🔄 Updating role to super_admin...`);
    const [updatedUser] = await db
      .update(users)
      .set({
        role: 'super_admin',
        updatedAt: new Date()
      })
      .where(eq(users.id, user.id))
      .returning();

    console.log(`🎉 Successfully promoted ${updatedUser.email} to super admin!`);
    console.log(`📋 New role: ${updatedUser.role}`);

  } catch (error) {
    console.error('❌ Error promoting user to super admin:', error);
    process.exit(1);
  } finally {
    await pool.end();
    console.log('🔌 Database connection closed');
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
