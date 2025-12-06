# Authentication System TODO

## ✅ Completed Features

### Core Authentication
- [x] **Session-based JWT tokens** - Tokens contain session IDs instead of user data for better security
- [x] **JWT Strategy & Guard** - Validates tokens, fetches sessions from MongoDB, checks expiration
- [x] **Multi-tenant architecture** - Sessions are tenant-aware with tenant identifier
- [x] **Dual session types** - Supports both visitor sessions (anonymous) and authenticated sessions (with userId)
- [x] **Session expiration validation** - JWT guard validates `session.timestamp + session.duration`

### User Management
- [x] **User MongoDB schema** - Complete user entity with Mongoose decorators
- [x] **Users service** - CRUD operations with MongoDB (migrated from Neo4j)
- [x] **Password hashing** - Using EncryptionService for secure password storage
- [x] **User profile endpoint** - `/users/profile` returns user data for authenticated sessions, session data for visitors

### Registration & Login Flow
- [x] **Anonymous session creation** - `POST /auth/session` creates visitor sessions
- [x] **Registration endpoint** - `POST /auth/register` requires session token (JwtAuthGuard)
- [x] **Welcome email on registration** - Sends professional HTML welcome email to new users
- [x] **Login endpoint** - `POST /auth/login` requires unauthenticated session token (JwtAuthGuard)
- [x] **Session authentication** - `authenticateSession()` converts anonymous session to authenticated by adding userId
- [x] **Token refresh on registration/login** - Returns new JWT token after successful authentication

### API Documentation
- [x] **Swagger/OpenAPI integration** - All endpoints documented
- [x] **@ApiBearerAuth decorators** - Protected endpoints show Authorization header requirement in Swagger UI
- [x] **Response DTOs** - Proper DTOs for both authenticated and visitor responses

### Email Notifications
- [x] **Gmail API integration** - Uses Google OAuth2 for sending emails
- [x] **Welcome email** - Professional HTML email sent on user registration
- [x] **Password reset email** - Secure token delivery with expiration notice
- [x] **Password reset confirmation** - Notification after successful password change
- [x] **Fallback logging** - Console output when Gmail API not configured
- [x] **HTML templates** - Responsive, professional email designs

---

## 📋 TODO - Features to Implement

### 1. Login Endpoint
**Priority: HIGH** ✅ **COMPLETED**
- [x] Create `POST /auth/login` endpoint
- [x] Accept email + password in request body
- [x] Validate credentials against users collection
- [x] Require unauthenticated session token (uses existing visitor session)
- [x] Convert visitor session to authenticated session for returning users
- [x] Return JWT token for the authenticated session
- [x] Add proper Swagger documentation with @ApiBearerAuth

### 2. Session Refresh/Renewal
**Priority: HIGH**
- [ ] Create `POST /auth/refresh` endpoint
- [ ] Allow extending session duration before expiration
- [ ] Validate current token and session status
- [ ] Update session timestamp and return new token
- [ ] Handle edge case: session already expired

### 3. Logout Mechanism
**Priority: MEDIUM** ✅ **COMPLETED**
- [x] Create `POST /auth/logout` endpoint
- [x] Add `status` field to session schema: `active | revoked | expired`
- [x] Mark session as `revoked` on logout
- [x] Update JWT guard to check session status
- [x] Invalidate token immediately (not just wait for expiration)
- [x] Return new unauthenticated session token after logout for visitor tracking

### 4. Password Reset Flow
**Priority: MEDIUM** ✅ **COMPLETED**
- [x] Create `POST /auth/forgot-password` endpoint
- [x] Generate password reset token (random, time-limited)
- [x] Store reset token in dedicated PasswordReset collection with expiration
- [x] Send password reset email (NotificationService with console.log placeholder)
- [x] Create `POST /auth/reset-password` endpoint
- [x] Validate reset token and update password
- [x] Invalidate reset token after use
- [x] Return new access token on successful reset for automatic login

### 5. Session Cleanup
**Priority: MEDIUM**
- [ ] Add MongoDB TTL index on sessions collection
- [ ] Set TTL based on session.timestamp + session.duration
- [ ] OR: Create cron job to delete expired sessions
- [ ] Consider archiving sessions for analytics before deletion

### 6. Rate Limiting
**Priority: MEDIUM**
- [ ] Install @nestjs/throttler package
- [ ] Add rate limiting to `/auth/register` endpoint
- [ ] Add rate limiting to `/auth/login` endpoint
- [ ] Add rate limiting to `/auth/forgot-password` endpoint
- [ ] Configure appropriate limits (e.g., 5 attempts per 15 minutes)
- [ ] Return 429 Too Many Requests with proper error message

### 7. Email Verification
**Priority: LOW**
- [ ] Add `emailVerified` boolean field to user schema
- [ ] Generate email verification token on registration
- [ ] Send verification email with token link
- [ ] Create `GET /auth/verify-email?token=xxx` endpoint
- [ ] Mark email as verified when token is valid
- [ ] Optionally block unverified users from certain actions

### 8. Multi-Device Session Management
**Priority: LOW**
- [ ] Create `GET /auth/sessions` endpoint to list user's active sessions
- [ ] Add device/browser info to session schema (user agent, IP)
- [ ] Create `DELETE /auth/sessions/:sessionId` to revoke specific session
- [ ] Create `DELETE /auth/sessions/all` to logout from all devices
- [ ] Show last active timestamp for each session

---

## 🔧 Technical Improvements

### Security Enhancements
- [ ] Implement refresh tokens (separate from access tokens)
- [ ] Add CSRF protection for session-based auth
- [ ] Implement account lockout after failed login attempts
- [ ] Add IP-based suspicious activity detection
- [ ] Implement 2FA (Two-Factor Authentication) support

### Monitoring & Logging
- [ ] Add audit log for authentication events
- [ ] Track failed login attempts
- [ ] Log session creation/destruction
- [ ] Monitor for unusual authentication patterns

### Testing
- [ ] Write unit tests for auth service methods
- [ ] Write e2e tests for auth flow (session → register → login → logout)
- [ ] Test session expiration edge cases
- [ ] Test concurrent session scenarios

---

## 📝 Notes

- Current session duration: 1 hour (3600000ms)
- JWT secret stored in environment variable: JWT_SECRET
- Sessions stored in MongoDB with optional userId field
- Multi-tenant system uses email domain detection
- Password hashing handled by EncryptionService

### Authentication Flow:
1. **Visitor creates session**: `POST /auth/session` → Returns JWT with session ID
2. **New user registers**: `POST /auth/register` (requires session token) → Updates session with userId → Returns new JWT
3. **Existing user logs in**: `POST /auth/login` (requires session token) → Updates session with userId → Returns new JWT
4. Both registration and login convert visitor sessions to authenticated sessions (doesn't create duplicates)