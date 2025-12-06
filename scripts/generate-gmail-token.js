const { google } = require('googleapis');
const readline = require('readline');
require('dotenv').config({ path: './env/dev.env' });

const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_EMAIL_CLIENT_ID,
  process.env.GOOGLE_EMAIL_CLIENT_SECRET,
  process.env.GOOGLE_EMAIL_REDIRECT_URI
);

// Generate the url that will be used for authorization
const authorizeUrl = oauth2Client.generateAuthUrl({
  access_type: 'offline',
  scope: ['https://www.googleapis.com/auth/gmail.send'],
  prompt: 'consent', // Force to always return refresh token
});

console.log('╔═══════════════════════════════════════════════════════════════════════════════╗');
console.log('║                    Gmail API Token Generator                                  ║');
console.log('╚═══════════════════════════════════════════════════════════════════════════════╝');
console.log('');
console.log('📧 This script will generate OAuth tokens for sending emails via Gmail API.');
console.log('');
console.log('Step 1: Authorize this app by visiting this URL:');
console.log('─'.repeat(80));
console.log(authorizeUrl);
console.log('─'.repeat(80));
console.log('');
console.log('Step 2: Sign in with the Gmail account you want to use for sending emails');
console.log('Step 3: Grant permissions when prompted');
console.log('Step 4: Copy the authorization code from the URL or page');
console.log('');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

rl.question('Enter the authorization code here: ', (code) => {
  rl.close();
  
  console.log('');
  console.log('⏳ Exchanging authorization code for tokens...');
  console.log('');
  
  oauth2Client.getToken(code, (err, token) => {
    if (err) {
      console.error('❌ Error retrieving access token:', err);
      return;
    }
    
    console.log('✅ Tokens generated successfully!');
    console.log('');
    console.log('═'.repeat(80));
    console.log('Add these lines to your env/dev.env file:');
    console.log('═'.repeat(80));
    console.log('');
    console.log(`GOOGLE_EMAIL_REFRESH_TOKEN=${token.refresh_token}`);
    console.log(`GOOGLE_EMAIL_ACCESS_TOKEN=${token.access_token}`);
    console.log('');
    console.log('═'.repeat(80));
    console.log('');
    console.log('⚠️  IMPORTANT:');
    console.log('   - Keep the REFRESH_TOKEN secret (it never expires unless revoked)');
    console.log('   - The ACCESS_TOKEN will be automatically refreshed by the app');
    console.log('   - Add GOOGLE_EMAIL_REFRESH_TOKEN to your .gitignore');
    console.log('');
    console.log('📝 Next Steps:');
    console.log('   1. Copy the GOOGLE_EMAIL_REFRESH_TOKEN line to env/dev.env');
    console.log('   2. Update src/notification/notification.service.ts to use the refresh token');
    console.log('   3. Restart your NestJS application');
    console.log('   4. Test by triggering a password reset request');
    console.log('');
    console.log('🎉 You\'re all set! Your app can now send emails via Gmail API.');
    console.log('');
  });
});
