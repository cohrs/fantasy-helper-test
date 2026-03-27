import { getDb } from '../src/lib/db';

const sql = getDb();

async function fixDuplicateUser() {
  console.log('🔧 Fixing duplicate Yahoo users...\n');
  
  // Check current state
  const users = await sql`
    SELECT yahoo_guid, email, (access_token IS NOT NULL) as has_token
    FROM users
    WHERE email = 'yahoo@yahoo-user.placeholder.com'
  `;
  
  console.log('Found users with yahoo@yahoo-user.placeholder.com:');
  users.forEach((u: any) => {
    console.log(`  - ${u.yahoo_guid} (has_token: ${u.has_token})`);
  });
  
  if (users.length > 1) {
    console.log('\n🗑️  Deleting user without tokens...');
    
    // Delete the one without tokens
    await sql`
      DELETE FROM users
      WHERE email = 'yahoo@yahoo-user.placeholder.com'
      AND access_token IS NULL
    `;
    
    console.log('✅ Deleted duplicate user(s) without tokens');
  }
  
  // Verify
  const remaining = await sql`
    SELECT yahoo_guid, email, (access_token IS NOT NULL) as has_token
    FROM users
    WHERE email = 'yahoo@yahoo-user.placeholder.com'
  `;
  
  console.log('\nRemaining users:');
  remaining.forEach((u: any) => {
    console.log(`  - ${u.yahoo_guid} (has_token: ${u.has_token})`);
  });
}

fixDuplicateUser()
  .then(() => {
    console.log('\n✅ Done! You may need to log out and back in.');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Error:', error);
    process.exit(1);
  });
