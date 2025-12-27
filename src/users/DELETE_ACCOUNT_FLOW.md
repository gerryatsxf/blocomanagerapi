# Delete Account Flow Documentation

## Overview
The **DELETE /users/me** endpoint allows authenticated users to permanently delete their own accounts. After deletion, the session is automatically degraded to an unauthenticated visitor session, similar to the logout flow.

## Endpoint Details

**URL:** `DELETE /users/me`

**Authentication:** Required (JWT Bearer token)

**Response:** Returns a new unauthenticated session token

---

## Flow Diagram

```
[Authenticated User] 
    ↓
[DELETE /users/me with JWT token]
    ↓
[Validate Authentication]
    ↓
[Delete User from Database]
    ↓
[Revoke Current Session]
    ↓
[Create New Visitor Session]
    ↓
[Return New access_token]
```

---

## Request Example

```bash
curl -X DELETE http://localhost:3002/users/me \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

---

## Response Examples

### Success (200 OK)
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjY3NDkzOGI4MWU3ZjA3NTE2YjY2NWU1ZSIsImlhdCI6MTczMjgzMTQxNiwiZXhwIjoxMDE3MzI4MzE0MTZ9.x8234tXdFGpvZVDcrT3c0FCohRH47eD2I_jdXv3WPl4"
}
```

The `access_token` is a new unauthenticated visitor session token that can be used for subsequent API calls.

### Error Responses

#### 401 Unauthorized
Missing or invalid JWT token.

```json
{
  "statusCode": 401,
  "message": "Unauthorized"
}
```

#### 403 Forbidden
Attempting to delete account with a visitor session token (not authenticated).

```json
{
  "statusCode": 401,
  "message": "Cannot delete account. You must be logged in with an authenticated account."
}
```

#### 404 Not Found
User account not found or already deleted.

```json
{
  "statusCode": 404,
  "message": "User account not found or already deleted."
}
```

---

## Complete Test Flow

### 1. Create Session
```bash
curl -X POST http://localhost:3002/auth/session \
  -H "Content-Type: application/json" \
  -d '{
    "tenant": "development",
    "host": "localhost:3002"
  }'
```

**Response:**
```json
{
  "access_token": "SESSION_TOKEN_123..."
}
```

### 2. Register User
```bash
curl -X POST http://localhost:3002/auth/register \
  -H "Authorization: Bearer SESSION_TOKEN_123..." \
  -H "Content-Type: application/json" \
  -d '{
    "email": "testuser@example.com",
    "password": "SecurePass123!",
    "firstName": "Test",
    "lastName": "User"
  }'
```

**Response:**
```json
{
  "access_token": "AUTHENTICATED_TOKEN_456..."
}
```

### 3. Use Account (Optional)
You can now use the authenticated token to access protected endpoints like `/users/profile`.

### 4. Delete Account
```bash
curl -X DELETE http://localhost:3002/users/me \
  -H "Authorization: Bearer AUTHENTICATED_TOKEN_456..."
```

**Response:**
```json
{
  "access_token": "VISITOR_TOKEN_789..."
}
```

### 5. Continue as Visitor (Optional)
You can now use the new visitor token for unauthenticated operations.

```bash
curl -X GET http://localhost:3002/users/profile \
  -H "Authorization: Bearer VISITOR_TOKEN_789..."
```

**Response:**
```json
{
  "sessionType": "visitor"
}
```

---

## Behavior Comparison: Delete vs Logout

| Aspect | DELETE /users/me | POST /auth/logout |
|--------|------------------|-------------------|
| User Data | **Permanently deleted** | Preserved |
| Session | Revoked and new visitor session created | Revoked and new visitor session created |
| Response | `{ "access_token": "..." }` | `{ "access_token": "..." }` |
| Reversible | ❌ No | ✅ Yes (can log back in) |
| Use Case | Delete account permanently | Temporary sign out |

---

## Important Notes

### ⚠️ Permanent Action
- Account deletion is **irreversible**
- All user data is permanently removed
- Email address becomes available for registration again

### 🔐 Security
- Only authenticated users can delete their account
- Users can only delete their **own** account
- Visitor session tokens cannot delete accounts

### 🔄 Session Degradation
- After deletion, a new unauthenticated visitor session is created
- This matches the logout behavior for consistency
- Frontend can immediately use the new token without additional API calls

### 📧 Email Reuse
- After deletion, the email address is immediately available
- This is useful for testing and development
- No cooldown period or soft-delete implemented

---

## Frontend Integration Example

```typescript
// React/TypeScript example
async function deleteAccount() {
  try {
    const response = await fetch('http://localhost:3002/users/me', {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${currentAuthToken}`
      }
    });
    
    if (!response.ok) {
      throw new Error('Failed to delete account');
    }
    
    const data = await response.json();
    
    // Store new visitor token
    localStorage.setItem('access_token', data.access_token);
    
    // Redirect to homepage as visitor
    window.location.href = '/';
    
    // Show confirmation message
    alert('Your account has been successfully deleted.');
    
  } catch (error) {
    console.error('Error deleting account:', error);
    alert('Failed to delete account. Please try again.');
  }
}
```

---

## Swagger Documentation

The endpoint is fully documented in Swagger UI at:
**http://localhost:3002/api**

Look for the **Users** section and find:
- **DELETE /users/me** - Delete your own user account and get new unauthenticated session

The Swagger UI provides:
- Try it out functionality
- Request/response examples
- Authentication requirements
- Error code descriptions

---

## Console Logging

When an account is deleted, the following is logged to the console:

```
🗑️  User account deleted: testuser@example.com (ID: 674938b81e7f07516b665e5e)
```

This helps with:
- Audit trails
- Debugging
- Monitoring account deletions

---

## Implementation Details

### Files Modified

1. **src/users/users.controller.ts**
   - Added `DELETE /users/me` endpoint
   - Validates authentication
   - Calls AuthService for deletion and session degradation
   - Returns new visitor token

2. **src/auth/auth.service.ts**
   - Added `deleteAccountAndDegradeSession()` method
   - Mirrors logout behavior
   - Revokes current session
   - Creates new visitor session

3. **src/users/users.module.ts**
   - Imported AuthModule with forwardRef to resolve circular dependency

### Architecture Pattern

The implementation follows the same pattern as logout:
1. User action (DELETE request)
2. Validate authentication
3. Perform destructive operation (delete user)
4. Revoke session
5. Create new visitor session
6. Return new token

This ensures consistency across the application and provides a familiar UX pattern.

---

## Testing Checklist

- [ ] Register a new user
- [ ] Verify user can log in
- [ ] Delete account with authenticated token
- [ ] Verify new visitor token is returned
- [ ] Attempt to log in with deleted credentials (should fail)
- [ ] Register again with the same email (should succeed)
- [ ] Attempt to delete with visitor token (should fail)
- [ ] Verify account deletion is logged to console

---

## Related Documentation

- [GMAIL_SETUP.md](./GMAIL_SETUP.md) - Email configuration
- [WELCOME_EMAIL_SETUP.md](./WELCOME_EMAIL_SETUP.md) - Welcome email setup
- [AUTH_TODO.md](./AUTH_TODO.md) - Authentication feature tracking

