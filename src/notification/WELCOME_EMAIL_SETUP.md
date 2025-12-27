# Welcome Email Setup Documentation

## Overview

The registration flow now includes automated welcome emails sent to new users upon successful account creation. This feature uses the same Gmail API integration as the password reset emails.

## 🎯 Features

### Professional Welcome Email
- **Beautiful HTML Template**: Responsive design with BlocoManager branding
- **Personalized Greeting**: Uses user's first name
- **Feature Highlights**: Showcases key platform capabilities
- **Clear Call-to-Action**: Direct link to dashboard
- **Social Links**: Connect with BlocoManager on social media
- **Help Resources**: Links to settings and help center

### Email Content Includes
✅ Personalized welcome message  
✅ Platform feature overview  
✅ Get Started button (links to dashboard)  
✅ Support contact information  
✅ Social media links  
✅ Account settings links  
✅ Professional footer with year and company info  

## 📧 Email Flow

### Registration Process
1. User completes registration via `POST /auth/register`
2. User account is created in MongoDB
3. **Welcome email is sent asynchronously** (non-blocking)
4. Session is authenticated and JWT token returned
5. User can immediately start using the platform

### Non-Blocking Design
- Email sending happens asynchronously
- Registration succeeds even if email fails
- Errors are logged but don't affect user experience
- No impact on API response time

## 🔧 Technical Implementation

### Files Modified

**`src/notification/notification.service.ts`**
- Added `sendWelcomeEmail()` method
- HTML template with responsive design
- Text fallback for plain email clients
- Gmail API integration with console fallback

**`src/auth/auth.service.ts`**
- Added `sendWelcomeEmail()` wrapper method
- Error handling and logging
- Non-blocking async execution

**`src/auth/auth.controller.ts`**
- Updated `register()` endpoint
- Calls welcome email after user creation
- Added comprehensive Swagger documentation
- Catches email errors without failing registration

### Code Structure

```typescript
// In auth.controller.ts
@Post('register')
async register(@Request() req, @Body() userRegistrationDto: UserRegistrationDto) {
  // 1. Create user
  const user = await this.usersService.create(...);
  
  // 2. Send welcome email (async, non-blocking)
  this.authService.sendWelcomeEmail(
    user.email,
    user.firstName,
    user.lastName,
  ).catch(error => {
    console.error('Failed to send welcome email:', error);
  });
  
  // 3. Authenticate session and return token
  return this.authService.authenticateSession(session._id, user._id.toString());
}
```

## 📝 Email Template Example

### HTML Email Preview
```
┌─────────────────────────────────────────────┐
│         🎉 Welcome to BlocoManager!         │
│            (Green Header)                   │
├─────────────────────────────────────────────┤
│                                             │
│  Hi [First Name],                           │
│                                             │
│  ┌─────────────────────────────────────┐   │
│  │ Thank you for joining BlocoManager! │   │
│  │ Your account has been successfully  │   │
│  │ created and you're all set!         │   │
│  └─────────────────────────────────────┘   │
│                                             │
│  What You Can Do:                           │
│  ✓ Smart Scheduling                         │
│  ✓ Calendar Integration                     │
│  ✓ Team Collaboration                       │
│  ✓ Automated Reminders                      │
│  ✓ Analytics & Insights                     │
│                                             │
│        [ Get Started Now ]                  │
│          (Green Button)                     │
│                                             │
│  Questions? Just reply to this email!       │
│                                             │
│  Best regards,                              │
│  The BlocoManager Team                      │
│                                             │
│  Follow us: Twitter | LinkedIn | Facebook   │
│                                             │
├─────────────────────────────────────────────┤
│  © 2025 BlocoManager. All rights reserved. │
│  Account Settings | Help Center             │
└─────────────────────────────────────────────┘
```

## 🧪 Testing

### Test Registration Flow

1. **Start the development server:**
```bash
npm run start:dev
```

2. **Create a session:**
```bash
curl -X POST http://localhost:3002/auth/session \
  -H "Content-Type: application/json"
```

Response:
```json
{
  "access_token": "eyJhbGc..."
}
```

3. **Register a new user:**
```bash
curl -X POST http://localhost:3002/auth/register \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_SESSION_TOKEN" \
  -d '{
    "email": "newuser@example.com",
    "password": "SecurePass123!",
    "firstName": "John",
    "lastName": "Doe"
  }'
```

4. **Check the console output:**

**If Gmail API is configured:**
```
✅ Google Gmail API initialized successfully
   Email notifications will be sent via Gmail API
✅ Email sent successfully to newuser@example.com
✅ Welcome email sent to: newuser@example.com
```

**If Gmail API is NOT configured:**
```
⚠️  GOOGLE_EMAIL_REFRESH_TOKEN not configured.
   Run: node scripts/generate-gmail-token.js
================================================================================
WELCOME EMAIL (Console Fallback)
================================================================================
To: newuser@example.com
Name: John Doe
================================================================================
Welcome to BlocoManager! 🎉

Hi John,

Thank you for joining BlocoManager!
...
================================================================================
✅ Welcome email sent to: newuser@example.com
```

### Test Swagger UI

1. Open: `http://localhost:3002/api`
2. Navigate to **Authentication** section
3. Find `POST /auth/register`
4. Review updated documentation with email notification info

## 🔄 Email Delivery Modes

### Mode 1: Gmail API Active (Production)
- Emails sent via Gmail API
- Professional "from" address
- Reliable delivery
- Gmail spam filtering protection
- HTML rendering in all email clients

### Mode 2: Console Logging (Development/Fallback)
- Email content logged to console
- Useful for development and testing
- No external dependencies required
- See full email content in terminal
- Easy debugging

## ⚙️ Configuration

### Required Environment Variables

```bash
# Gmail API Configuration (for actual email sending)
GOOGLE_EMAIL_CLIENT_ID=your_client_id
GOOGLE_EMAIL_CLIENT_SECRET=your_client_secret
GOOGLE_EMAIL_REFRESH_TOKEN=your_refresh_token  # Required for sending

# Frontend URLs (for email links)
FRONTEND_URL=http://localhost:3000  # Development
# FRONTEND_URL=https://app.blocomanager.com  # Production
```

### Setup Gmail API

See [GMAIL_SETUP.md](./GMAIL_SETUP.md) for complete instructions:

```bash
# Generate refresh token
node scripts/generate-gmail-token.js

# Add GOOGLE_EMAIL_REFRESH_TOKEN to env/dev.env
# Restart server
npm run start:dev
```

## 🎨 Customization

### Modify Email Template

Edit `src/notification/notification.service.ts` → `sendWelcomeEmail()` method:

**Change Colors:**
```typescript
// Replace #4CAF50 with your brand color
.header { background-color: #YOUR_COLOR; }
.button { background-color: #YOUR_COLOR; }
```

**Update Content:**
```typescript
// Modify welcome message
<h2>Welcome to Your Company!</h2>
<p>Custom welcome message here...</p>
```

**Add Features:**
```typescript
<div class="feature-item">
  <strong>Your Feature</strong> - Description
</div>
```

**Change Links:**
```typescript
// Update dashboard link
<a href="${frontendUrl}/your-dashboard" class="button">

// Update social links
<a href="https://twitter.com/your_handle">Twitter</a>
```

## 📊 Monitoring

### Success Indicators
```
✅ Email sent successfully to user@example.com
✅ Welcome email sent to: user@example.com
```

### Warning Indicators
```
⚠️  GOOGLE_EMAIL_REFRESH_TOKEN not configured.
   Run: node scripts/generate-gmail-token.js
```

### Error Indicators
```
❌ Failed to send welcome email to user@example.com: [error details]
Failed to send email via Gmail API: [error details]
```

### Email Logs Location
- **Console Output**: Terminal where server is running
- **Application Logs**: Check your logging service if configured
- **Gmail API Errors**: Google Cloud Console → APIs & Services → Gmail API

## 🚀 Production Checklist

Before deploying to production:

- [ ] Gmail API fully configured with refresh token
- [ ] Test email sending with real email addresses
- [ ] Update `FRONTEND_URL` to production domain
- [ ] Customize email template with brand colors/logo
- [ ] Update social media links to actual profiles
- [ ] Test email rendering in multiple clients (Gmail, Outlook, Apple Mail)
- [ ] Set up email monitoring and error alerts
- [ ] Configure SPF/DKIM records for sending domain
- [ ] Review Gmail API quotas and upgrade if needed
- [ ] Add rate limiting to registration endpoint
- [ ] Test email delivery to spam folders
- [ ] Verify all links in email work correctly

## 🔒 Security Best Practices

1. **Never commit credentials** - Keep tokens in `.gitignore`
2. **Use environment variables** - Never hardcode API keys
3. **Separate environments** - Different credentials for dev/staging/prod
4. **Monitor API usage** - Set up alerts for unusual activity
5. **Rotate tokens regularly** - Update refresh tokens periodically
6. **Rate limiting** - Prevent email spam via registration abuse
7. **Validate email addresses** - Implement email verification if needed

## 📚 Related Documentation

- [GMAIL_SETUP.md](./GMAIL_SETUP.md) - Gmail API setup instructions
- [AUTH_TODO.md](./src/auth/AUTH_TODO.md) - Authentication feature tracker
- [README.md](./README.md) - General project setup

## ❓ Troubleshooting

### Welcome email not sending
1. Check if Gmail API is configured: Look for initialization message in console
2. Verify `GOOGLE_EMAIL_REFRESH_TOKEN` exists in `env/dev.env`
3. Check console for error messages
4. Review Gmail API quotas in Google Cloud Console

### Email goes to spam
1. Verify sending domain has SPF/DKIM records
2. Warm up sending domain (start with low volume)
3. Add proper "from" name and address
4. Avoid spam trigger words in subject/content

### Template not rendering correctly
1. Test in multiple email clients
2. Validate HTML structure
3. Check inline CSS (required for email)
4. Use email testing tools (Litmus, Email on Acid)

### Links in email not working
1. Verify `FRONTEND_URL` is set correctly
2. Check for CORS issues
3. Test links in different browsers
4. Ensure frontend routes exist

## 🎉 Success Metrics

Track these metrics to measure success:

- **Email Delivery Rate**: % of emails successfully sent
- **Open Rate**: % of users who open welcome email
- **Click-Through Rate**: % who click "Get Started" button
- **Error Rate**: % of failed email sends
- **Time to First Login**: Days between registration and first login

## 📞 Support

If you encounter issues:

1. Check the troubleshooting section above
2. Review console logs for error messages
3. Verify environment configuration
4. Test with curl commands to isolate issues
5. Check Gmail API status: https://status.cloud.google.com/

For additional help:
- Internal team documentation
- Google Cloud Support (for Gmail API issues)
- Stack Overflow for general email delivery questions
