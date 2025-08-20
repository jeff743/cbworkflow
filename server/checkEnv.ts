
#!/usr/bin/env node

console.log('🔍 Environment Diagnostics');
console.log('========================');
console.log(`NODE_ENV: ${process.env.NODE_ENV}`);
console.log(`DATABASE_URL exists: ${process.env.DATABASE_URL ? 'Yes' : 'No'}`);
console.log(`DATABASE_URL length: ${process.env.DATABASE_URL?.length || 0}`);
console.log(`DATABASE_URL starts with: ${process.env.DATABASE_URL?.substring(0, 20) || 'N/A'}...`);

// Test database import
try {
  const { db } = await import('./db.js');
  console.log('✅ Database module imported successfully');
  
  // Test connection
  try {
    const result = await db.$client.query('SELECT 1 as test');
    console.log('✅ Database connection test successful');
  } catch (error) {
    console.error('❌ Database connection test failed:', error);
  }
} catch (error) {
  console.error('❌ Failed to import database module:', error);
}
