import { getDb } from './src/lib/db.ts';

const sql = getDb();

async function checkSession() {
  console.log('🔍 Checking user tokens...\n');
  
  const users = await sql`
    SELECT 
      yahoo_guid, 
      email, 
      nickname,
      (access_token IS NOT NULL) as has_token, 
      (refresh_token IS NOT NULL) as has_refresh, 
      token_expires_at,
      updated_at
    FROM users 
    ORDER BY updated_at DESC
  `;
  
  console.log('Users in database:');
  users.forEach(u => {
    console.log(`\n  Yahoo GUID: ${u.yahoo_guid}`);
    console.log(`  Email: ${u.email}`);
    console.log(`  Nickname: ${u.nickname || 'N/A'}`);
    console.log(`  Has Token: ${u.has_token}`);
    console.log(`  Has Refresh: ${u.has_refresh}`);
    console.log(`  Token Expires: ${u.token_expires_at || 'N/A'}`);
    console.log(`  Last Updated: ${u.updated_at}`);
  });
  
  console.log('\n\n💡 When you login, the session email is constructed as:');
  console.log('   {yahoo_guid}@yahoo-user.placeholder.com');
  console.log('\n   The code extracts yahoo_guid by splitting email on "@"');
  console.log('   So if email is "ABC123@yahoo-user.placeholder.com"');
  console.log('   It will look for user with yahoo_guid = "ABC123"');
}

checkSession()
  .then(() => process.exit(0))
  .catch(e => { console.error(e); process.exit(1); });
