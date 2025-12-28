# BlocoManager Admin Panel

A minimal, modern admin panel for managing users, tenants, and subscriptions in BlocoManager.

## Features

### 🔐 Authentication
- Secure login with super admin role verification
- JWT-based authentication
- Session management

### 👥 User Management
- View all users with pagination
- Edit user details (name, email, etc.)
- Assign roles (User, Tenant Admin, Super Admin)
- View user activity and sessions
- Delete user accounts

### 🏢 Tenant Management
- View all tenants with statistics
- See user counts per tenant
- View tenant-specific data
- Track session counts

### 💳 Subscription Management
- View all subscriptions with user details
- Manual subscription plan updates
- Pagination support

### 📊 Dashboard
- Total users count
- Total tenants
- Total subscriptions
- Overview statistics

## Access

The admin panel is available at:
```
http://localhost:3002/public/admin/index.html
```

## Setup

### 1. Assign Super Admin Role

First, you need to manually assign the super admin role to your account in the database:

```javascript
// Using MongoDB shell or Compass
db.users.updateOne(
  { email: "your@email.com" },
  { $set: { role: "superAdmin" } }
)
```

### 2. Login

1. Navigate to `http://localhost:3002/public/admin/index.html`
2. Enter your email and password
3. The system will verify your super admin role
4. Access granted!

## API Endpoints

All admin endpoints are protected by JWT authentication and super admin role verification.

### Dashboard
- `GET /admin/dashboard/stats` - Get dashboard statistics

### Users
- `GET /admin/users?page=1&limit=50` - Get all users
- `GET /admin/users/:userId` - Get user by ID
- `PATCH /admin/users/:userId` - Update user details
- `PATCH /admin/users/:userId/role` - Update user role
- `DELETE /admin/users/:userId` - Delete user account
- `GET /admin/users/:userId/activity` - Get user activity

### Tenants
- `GET /admin/tenants` - Get all tenants
- `GET /admin/tenants/:tenantId` - Get tenant data

### Subscriptions
- `GET /admin/subscriptions?page=1&limit=50` - Get all subscriptions
- `PATCH /admin/subscriptions/:userId` - Update user subscription

## User Roles

### Super Admin
- Full access to admin panel
- Can manage all users, tenants, and subscriptions
- Can assign roles to other users

### Tenant Admin
- Manages specific tenant
- (To be implemented in future updates)

### User
- Regular user with no admin privileges

## Security

- All admin routes require JWT authentication
- Super admin role is verified on every request
- Passwords are never exposed in API responses
- Sessions are properly managed

## Technology Stack

- **Backend**: NestJS with TypeScript
- **Frontend**: Vanilla JavaScript (no frameworks)
- **Database**: MongoDB
- **Authentication**: JWT with role-based access control
- **Styling**: Custom CSS with modern dark theme

## Development

The admin panel is built with:
- `src/admin/` - Backend admin module
  - `admin.controller.ts` - API endpoints
  - `admin.service.ts` - Business logic
  - `admin.module.ts` - Module configuration
  - `guards/super-admin.guard.ts` - Role verification
- `public/admin/` - Frontend assets
  - `index.html` - Main UI
  - `styles.css` - Modern dark theme styling
  - `app.js` - Application logic and API calls

## Future Enhancements

- [ ] Advanced filtering and search
- [ ] Export data to CSV
- [ ] User activity timeline
- [ ] Email notifications
- [ ] Tenant-specific admin access
- [ ] Payment history tracking
- [ ] Bulk operations
- [ ] Audit logs

## Troubleshooting

### "Access denied. Super admin role required"
Make sure your user has the `superAdmin` role in the database.

### "Session expired"
Re-login to get a fresh JWT token.

### API endpoints not working
Verify that the AdminModule is imported in `app.module.ts` and the server is running on port 3002.

## Support

For issues or questions, contact the development team.
