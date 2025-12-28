# Gmail API Setup Guide

This guide explains how to complete the Gmail API OAuth2 setup for sending password reset emails.

## ✅ Completed Steps

1. **Google Cloud Project Created** - Project ID: `blocomanager`
2. **OAuth2 Credentials Generated** - Client ID and Secret added to `env/dev.env`
3. **NotificationService Updated** - Gmail API integration with HTML email templates

## 📋 Remaining Steps to Enable Email Sending

### Step 1: Enable Gmail API in Google Cloud Console

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Select project: `blocomanager`
3. Navigate to **APIs & Services** > **Library**
4. Search for "Gmail API"
5. Click **Enable**

### Step 2: Configure OAuth Consent Screen

1. Go to **APIs & Services** > **OAuth consent screen**
2. Choose **External** user type (or Internal if using Google Workspace)
3. Fill in required information:
   - App name: `BlocoManager`
   - User support email: `blocomanager@gmail.com`
   - Developer contact: your email
4. Add scopes:
   - `https://www.googleapis.com/auth/gmail.send` (Send emails only)
5. Add test users (for testing phase):
   - Add your email addresses
6. Save and continue

### Step 3: Generate OAuth Tokens

You need to generate a **refresh token** that the application will use to send emails on behalf of your Gmail account.

#### Option A: Using the Code (Recommended for Development)

Create a one-time script to generate tokens:

```bash
# Install googleapis if not already installed
npm install googleapis

# Create a token generation script
```

Create `scripts/generate-gmail-token.js`:

```javascript
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
});

console.log('Authorize this app by visiting this url:', authorizeUrl);

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

rl.question('Enter the code from that page here: ', (code) => {
  rl.close();
  oauth2Client.getToken(code, (err, token) => {
    if (err) return console.error('Error retrieving access token', err);
    
    console.log('\n✅ Tokens generated successfully!');
    console.log('\nAdd this to your env/dev.env file:');
    console.log(`GOOGLE_EMAIL_REFRESH_TOKEN=${token.refresh_token}`);
    console.log(`GOOGLE_EMAIL_ACCESS_TOKEN=${token.access_token}`);
  });
});
```

Run the script:

```bash
node scripts/generate-gmail-token.js
```

#### Option B: Using OAuth Playground (Alternative)

1. Go to [OAuth 2.0 Playground](https://developers.google.com/oauthplayground/)
2. Click the gear icon (⚙️) in the top right
3. Check "Use your own OAuth credentials"
4. Enter your Client ID and Client Secret
5. In Step 1, select `https://mail.google.com/` or `https://www.googleapis.com/auth/gmail.send`
6. Click "Authorize APIs"
7. Sign in with the Gmail account you want to use for sending emails
8. Click "Exchange authorization code for tokens"
9. Copy the **refresh_token** value

### Step 4: Update Environment Variables

Add the refresh token to `env/dev.env`:

```bash
# Add this line with the refresh token from Step 3
GOOGLE_EMAIL_REFRESH_TOKEN=your_refresh_token_here
```

### Step 5: Update NotificationService

Update the `initializeGoogleAuth()` method in `src/notification/notification.service.ts` to use the refresh token:

```typescript
private initializeGoogleAuth() {
  try {
    const clientId = this.configService.get<string>('GOOGLE_EMAIL_CLIENT_ID');
    const clientSecret = this.configService.get<string>('GOOGLE_EMAIL_CLIENT_SECRET');
    const redirectUri = this.configService.get<string>('GOOGLE_EMAIL_REDIRECT_URI');
    const refreshToken = this.configService.get<string>('GOOGLE_EMAIL_REFRESH_TOKEN');

    if (!clientId || !clientSecret || !refreshToken) {
      console.warn('Google OAuth credentials not fully configured. Email sending will use console logging only.');
      return;
    }

    this.oauth2Client = new google.auth.OAuth2(
      clientId,
      clientSecret,
      redirectUri,
    );

    // Set the refresh token
    this.oauth2Client.setCredentials({
      refresh_token: refreshToken,
    });
    
    this.gmail = google.gmail({ version: 'v1', auth: this.oauth2Client });
    
    console.log('✅ Google Gmail API initialized successfully');
  } catch (error) {
    console.error('Failed to initialize Google Gmail API:', error.message);
  }
}
```

## 🧪 Testing Email Sending

### Test Password Reset Email

```bash
# Start the dev server
npm run start:dev

# Make a request to forgot-password endpoint
curl -X POST http://localhost:3002/auth/forgot-password \
  -H "Content-Type: application/json" \
  -d '{"email": "your-test-email@example.com"}'
```

Check the console output:
- ✅ If configured correctly: "Email sent successfully to your-test-email@example.com"
- ⚠️ If not configured: Console fallback with email content logged

## 📝 Environment Variables Reference

```bash
# Gmail API Configuration (in env/dev.env)
GOOGLE_EMAIL_CLIENT_ID=your-client-id-here.apps.googleusercontent.com
GOOGLE_EMAIL_CLIENT_SECRET=GOCSPX-your-client-secret-here
GOOGLE_EMAIL_PROJECT_ID=your-project-id
GOOGLE_EMAIL_AUTH_URI=https://accounts.google.com/o/oauth2/auth
GOOGLE_EMAIL_TOKEN_URI=https://oauth2.googleapis.com/token
GOOGLE_EMAIL_REDIRECT_URI=http://localhost:3002/auth/google/callback
GOOGLE_EMAIL_REFRESH_TOKEN=your_refresh_token_here  # ⚠️ NEEDS TO BE ADDED

# Frontend URL for reset links
FRONTEND_URL=http://localhost:3000
```

## 🔒 Security Best Practices

1. **Never commit credentials** - Keep `dev.env` in `.gitignore`
2. **Use different credentials for production** - Generate separate OAuth credentials
3. **Rotate tokens regularly** - Refresh tokens can be revoked and regenerated
4. **Monitor usage** - Check Google Cloud Console for API usage and errors
5. **Rate limiting** - Gmail API has sending limits (consider adding @nestjs/throttler)

## 🚀 Production Deployment

For production, consider:

1. **Use environment-specific credentials** - Different OAuth credentials per environment
2. **Store secrets securely** - Use secrets manager (AWS Secrets Manager, Google Secret Manager, etc.)
3. **Set up proper domain** - Update redirect URIs to production domain
4. **Verify domain ownership** - Add domain verification in Google Cloud Console
5. **Remove test users** - Publish the OAuth consent screen
6. **Monitor email delivery** - Set up logging and monitoring
7. **Consider alternatives** - For high-volume sending, consider SendGrid, AWS SES, or Mailgun

## 📚 Additional Resources

- [Gmail API Documentation](https://developers.google.com/gmail/api)
- [OAuth 2.0 for Web Server Applications](https://developers.google.com/identity/protocols/oauth2/web-server)
- [Gmail API Send Email Guide](https://developers.google.com/gmail/api/guides/sending)
- [Google Cloud Console](https://console.cloud.google.com)

## ❓ Troubleshooting

### "Gmail API not configured" warning
- Complete Steps 1-5 above
- Verify all environment variables are set correctly
- Restart the NestJS application

### "Invalid refresh token" error
- Regenerate tokens using the script in Step 3
- Ensure the refresh token hasn't been revoked
- Check OAuth consent screen is properly configured

### Emails not arriving
- Check spam/junk folder
- Verify the sender email is authorized
- Check Gmail API quotas in Google Cloud Console
- Review application logs for error messages

### Rate limiting errors
- Gmail API has daily sending limits (500/day for free tier)
- Implement proper error handling and retry logic
- Consider upgrading or using alternative email service
