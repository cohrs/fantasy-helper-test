import { getYahooAccessToken } from './src/lib/yahoo-auth.ts';

async function refreshToken() {
  console.log('🔄 Attempting to refresh Yahoo token for yahoo-user...\n');
  
  const token = await getYahooAccessToken('yahoo-user');
  
  if (token) {
    console.log('✅ Successfully got access token');
    console.log('Token (first 20 chars):', token.substring(0, 20) + '...');
  } else {
    console.log('❌ Failed to get access token');
    console.log('\nPossible reasons:');
    console.log('1. Refresh token expired (need to re-login)');
    console.log('2. Yahoo API error');
    console.log('3. Invalid credentials in .env.local');
  }
}

refreshToken()
  .then(() => process.exit(0))
  .catch(e => { console.error('Error:', e); process.exit(1); });
