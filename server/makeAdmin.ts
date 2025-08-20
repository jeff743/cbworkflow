import { db } from './db';
import { users } from '../shared/schema';
import { eq } from 'drizzle-orm';

async function makeUserSuperAdmin(email: string) {
  try {
    console.log(`🔍 Looking for user with email: ${email}`);

    // Find the user by email
    const [user] = await db.select().from(users).where(eq(users.email, email));

    if (!user) {
      console.error(`❌ User with email ${email} not found in database`);
      console.log('💡 Make sure the user has logged into the app at least once');
      process.exit(1);
    }

    console.log(`✅ Found user: ${user.name || user.email} (ID: ${user.id})`);
    console.log(`📋 Current role: ${user.role}`);

    if (user.role === 'super_admin') {
      console.log('✅ User is already a super admin!');
      process.exit(0);
    }

    // Update user role to super_admin
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

    process.exit(0);
  } catch (error) {
    console.error('❌ Error promoting user to super admin:', error);
    process.exit(1);
  }
}

// Get email from command line arguments
const email = process.argv[2];

if (!email) {
  console.error('❌ Please provide an email address');
  console.log('Usage: npm run make-super-admin <email@example.com>');
  process.exit(1);
}

// Run the function
makeUserSuperAdmin(email);