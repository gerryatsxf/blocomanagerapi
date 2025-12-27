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
**Priority: HIGH** ✅ **COMPLETED**
- [x] Create `POST /auth/refresh` endpoint
- [x] Allow extending session duration before expiration
- [x] Validate current token and session status
- [x] Update session timestamp (no new token needed - session updated in DB)
- [x] Handle edge case: session already expired

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
- [x] Create `POST /auth/forgot-password` endpoint (public, for visitors)
- [x] Generate password reset token (random, time-limited, 1 hour expiration)
- [x] Store reset token in dedicated PasswordReset collection with bcrypt hashing
- [x] Send password reset email with HTML templates
- [x] Create `POST /auth/reset-password` endpoint (public)
- [x] Validate reset token using bcrypt compare (not hash)
- [x] Invalidate reset token after use
- [x] **Separated change-password flow for authenticated users**:
  - [x] `POST /auth/change-password-request` (authenticated)
  - [x] `POST /auth/change-password` (authenticated, keeps session active)
  - [x] Uses PasswordResetType enum to distinguish flows
- [x] User remains visitor after forgot-password reset (must login)
- [x] Comprehensive Swagger documentation with frontend examples

### 5. Session Cleanup
**Priority: MEDIUM**
- [ ] Add MongoDB TTL index on sessions collection
- [ ] Set TTL based on session.timestamp + session.duration
- [ ] OR: Create cron job to delete expired sessions
- [ ] Consider archiving sessions for analytics before deletion

### 6. Rate Limiting
**Priority: MEDIUM** ✅ **COMPLETED**
- [x] Install @nestjs/throttler package
- [x] Add rate limiting to `/auth/register` endpoint (5 requests per 15 minutes)
- [x] Add rate limiting to `/auth/login` endpoint (5 requests per 15 minutes)
- [x] Add rate limiting to `/auth/forgot-password` endpoint (3 requests per 15 minutes)
- [x] Configure ThrottlerModule globally in AppModule
- [x] Apply ThrottlerGuard globally via APP_GUARD provider
- [x] Use @Throttle decorator for per-endpoint rate limits
- [x] Return 429 Too Many Requests with proper error message
- [x] Add comprehensive Swagger documentation for rate limits

### 7. Email Verification
**Priority: LOW** ✅ **COMPLETED**
- [x] Add `emailVerified` boolean field to user schema
- [x] Generate email verification token on registration
- [x] Send verification email with token link in welcome email
- [x] Create `POST /auth/verify-email` endpoint
- [x] Mark email as verified when token is valid
- [x] Return proper success/error messages
- [x] Handle already-verified case gracefully

### 8. Email Change Flow
**Priority: HIGH** ✅ **COMPLETED**
- [x] **3-step secure email change process** (enterprise-grade security)
- [x] Step 1: `POST /auth/change-email-request` (authenticated)
  - [x] Sends verification token to CURRENT email
  - [x] Requires authenticated session
- [x] Step 2: `POST /auth/change-email` (authenticated)
  - [x] Validates token from current email
  - [x] Accepts new email address
  - [x] Sends verification token to NEW email
  - [x] Checks email availability and pending changes
- [x] Step 3: `POST /auth/confirm-email-change` (public)
  - [x] Validates token from new email
  - [x] Updates user email in database
  - [x] **Revokes all active sessions** across all devices
  - [x] **Returns new visitor session token**
  - [x] Forces re-login with new email
- [x] Uses EmailChange collection with step tracking (VERIFY_CURRENT, VERIFY_NEW, COMPLETED)
- [x] Bcrypt token validation (same security as password reset)
- [x] Race condition protection (double-checks availability)
- [x] Email masking in responses for security
- [x] Comprehensive Swagger documentation with security model explanation
- [x] HTML email templates for all 3 steps

### 9. Profile Management
**Priority: MEDIUM** ✅ **COMPLETED**
- [x] Create `PATCH /users/profile` endpoint
- [x] Allow updating firstName and lastName
- [x] **Security whitelist approach** - explicitly blocks email/password updates
- [x] Requires authenticated session
- [x] Validation for field lengths (1-50 characters)
- [x] Returns updated profile data
- [x] Comprehensive Swagger documentation

### 10. Account Deletion
**Priority: MEDIUM** ✅ **COMPLETED**
- [x] Create `DELETE /users/me` endpoint
- [x] Permanently delete user account and all data
- [x] Revoke current authenticated session
- [x] Return new visitor session token (like logout)
- [x] Requires authenticated session
- [x] Cannot delete using visitor token
- [x] Proper error handling and confirmation

### 11. Multi-Device Session Management
**Priority: LOW**
- [ ] Create `GET /auth/sessions` endpoint to list user's active sessions
- [ ] Add device/browser info to session schema (user agent, IP)
- [ ] Create `DELETE /auth/sessions/:sessionId` to revoke specific session
- [ ] Create `DELETE /auth/sessions/all` to logout from all devices
- [ ] Show last active timestamp for each session
- [x] **Implemented**: `revokeAllUserSessions()` in SessionService (used by email change)

---

## 🆕 Additional Features Implemented

### Contact Form System
**Priority: MEDIUM** ✅ **COMPLETED**
- [x] Create `POST /contact` endpoint (public, no authentication)
- [x] Accept: name, email, subject, priority, message
- [x] Priority levels: low, medium, high, urgent
- [x] Generate unique reference ID (format: CR-YYYYMMDD-XXXXXX)
- [x] Store in Contact collection with status tracking
- [x] Status enum: NEW, IN_PROGRESS, RESOLVED, CLOSED
- [x] MongoDB indexes for performance (referenceId, email, status, priority)
- [x] Full validation with class-validator
- [x] Comprehensive Swagger documentation with 3 example scenarios

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
- Password hashing handled by EncryptionService (bcrypt)
- **Token security**: All tokens (password reset, email change) use bcrypt hashing
- **Email change security**: Requires access to CURRENT email, NEW email, AND authenticated session
- **Session revocation**: Implemented for logout, account deletion, and email change

### Authentication Flow:
1. **Visitor creates session**: `POST /auth/session` → Returns JWT with session ID
2. **New user registers**: `POST /auth/register` (requires session token) → Updates session with userId → Returns new JWT
3. **Existing user logs in**: `POST /auth/login` (requires session token) → Updates session with userId → Returns new JWT
4. Both registration and login convert visitor sessions to authenticated sessions (doesn't create duplicates)
5. **Logout**: Revokes current session, returns new visitor session token
6. **Account deletion**: Deletes user, revokes session, returns new visitor token
7. **Email change**: 3-step verification, revokes all sessions, returns new visitor token

### Password Management:
- **Forgot password** (visitor/public): User stays visitor after reset, must login manually
- **Change password** (authenticated): User stays authenticated after change, session preserved
- Two separate flows using PasswordResetType enum: FORGOT_PASSWORD, CHANGE_PASSWORD

### Email Change Security Model:
Requires access to THREE separate resources:
1. Active authenticated session (logged in)
2. Current email inbox (proves ownership of existing email)
3. New email inbox (proves ownership of target email)

This protects against account takeover even if attacker has password + session.