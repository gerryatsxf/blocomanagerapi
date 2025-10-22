# PRD: Tenant Management System & Admin Panel

## Overview
Design a tenant management system that allows B2B customers to authenticate and manage their installations through an admin panel with tenant-specific session management.

## Background
The system currently supports multiple tenants (aprendecoding, pedrorivero, blocomanager) with basic domain-based detection. We need tenant-specific session management and B2B customer authentication.

## Key Requirements

### 1. Tenant Authentication System
- **Admin User Management**: Each tenant can have multiple admin users with role-based access
- **Secure Authentication**: JWT-based authentication for tenant administrators
- **BlocoManager Sessions**: Administrative sessions for managing other tenants

### 2. Tenant-Specific Session Status Management

**AprendeCoding & PedroRivero Tenants:**
- Session Statuses: `lead` (default), `processing`, `processed`
- Booking Statuses: `pending`, `paid`, `stale`, `failed`

**BlocoManager Tenant (Admin Sessions):**
- Session Statuses: `draft`, `active`, `suspended`, `archived`, `maintenance`, `audit`
- Booking Statuses: N/A (administrative context)

### 3. Admin Panel Features
- **Authentication Dashboard**: Secure login and session management
- **Tenant Configuration**: Manage tenant-specific properties and session statuses
- **Session Management**: View and update session statuses with tenant-specific validation
- **Analytics**: Session statistics and reports per tenant
- **Gmail Integration**: Configure tenant Gmail accounts for calendar event creation

**Gmail Calendar Integration:**
Each tenant can configure their Gmail account credentials (OAuth2) in the admin panel. When calendar events are created through Nylas, the system will use the tenant's configured Gmail account as the event creator/organizer. This ensures events appear as created by the tenant's professional email address (e.g., pedro@pedrorivero.com) rather than a generic system email. Tenants can authenticate via Google OAuth, and credentials are securely stored with encryption. The integration respects tenant isolation - each tenant's events are created using their own Gmail account.

### 4. Technical Implementation
- **Database Extensions**: Admin user schema and tenant configuration schema
- **API Endpoints**: RESTful admin APIs for authentication and tenant management
- **Session Validation**: Enforce tenant-specific allowed statuses
- **Security**: Tenant data isolation and audit logging
- **Install Management Service**: Manage tenant installations and configurations
- **Admin User Service**: Handle tenant admin user authentication and permissions

**Additional Services:**
- **InstallService**: Manages tenant installations, deployment configurations, version control, and environment settings. Tracks install status, health monitoring, and update management per tenant. Provides backend logic for tenant admin panels to monitor and configure their installations.
- **AdminUserService**: Provides authentication, authorization, and user management logic specifically for tenant administrators. Handles role assignments, permission validation, and admin-specific operations separate from regular user management.

**TenantService Core Features:**
- **End User Management**: APIs for tenant admins to view, create, and manage their customers/end users
  - View end user profiles and contact information
  - Create and onboard new end users
  - Update end user preferences and settings
  - Deactivate or suspend end user accounts
  - Track end user session history and booking patterns
  - Manage end user communication preferences
  - Export end user data and reports
- **Revenue Analytics**: Payment tracking, booking revenue calculations, and financial reporting
- **Session/Booking Analytics**: Conversion rates, completion metrics, and usage statistics
- **Brand Customization**: Logo uploads, color schemes, email templates, and domain configuration
- **Integration Settings**: Calendar connections, payment gateway setup, and notification preferences
- **Performance Monitoring**: System health checks, uptime tracking, and response time metrics
- **Support Tools**: Customer communication logs and support ticket management systems
- **Billing Overview**: Subscription status monitoring, usage limits, and invoice generation
- **API Management**: API key generation, rate limiting, and webhook configuration

### 5. Implementation Phases
1. **Phase 1**: Core tenant configuration and session status system
2. **Phase 2**: Admin authentication and basic panel
3. **Phase 3**: Advanced features and analytics
4. **Phase 4**: Security audit and optimization

## Success Metrics
- 99.5% authentication success rate
- 50% reduction in manual session management
- <200ms API response times