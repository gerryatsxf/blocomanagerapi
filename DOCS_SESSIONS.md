# Sessions Documentation

## Overview

Sessions in BlocoManager represent temporary user interactions that track the booking and payment flow. They serve as the primary entity connecting leads, bookings, and payment processes.

## Session Lifecycle

### 1. Creation
Sessions are created in two ways:
- **General Session**: `create()` - Creates a basic 1-hour session
- **Lead Session**: `createLeadSession(leadId)` - Creates a session tied to a specific lead with initial stage `st_greet`

### 2. Properties
- `timestamp`: Creation time in milliseconds
- `duration`: Session validity (default: 1 hour)
- `status`: Current status (default: 'lead')
- `leadId`: Associated lead identifier
- `leadStage`: Current lead stage (e.g., 'st_greet')
- `tenant`: Required tenant identifier (e.g., 'aprendecoding', 'pedrorivero')
- `clientReferenceId`: SHA512 hash linking to Stripe payments
- `processingTimestamp`: When session entered processing state
- `timezone`: Session timezone (optional)

### 3. Multi-Tenant Support
Sessions are tenant-aware:
- `tenant` property identifies which organization the session belongs to
- Tenant is automatically extracted from request domain (Host header)
- Domain mapping: `aprendecoding.com` → `'aprendecoding'`, `pedrorivero.com` → `'pedrorivero'`
- Enables tenant-specific business logic and customizations

### 4. Payment Integration
When a booking is created:
1. Session gets a `clientReferenceId` (SHA512 hash of session ID)
2. This ID is passed to Stripe as `client_reference_id`
3. Payment webhooks use this ID to identify the originating session
4. Session status updates to 'processing' during payment flow

### 5. Key Operations
- `create(tenant?)`: Create session with optional tenant override
- `createLeadSession(leadId, tenant?)`: Create lead-specific session with tenant
- `findByClientReferenceId()`: Retrieve session from Stripe webhook
- `findByLeadId()`: Find session for specific lead
- `update()`: Modify session properties
- Status transitions: 'lead' → 'processing' → 'paid'

## Usage in Payment Flow
Sessions bridge the gap between user booking intent and payment completion, ensuring data consistency across the payment lifecycle while maintaining tenant isolation for multi-tenant SaaS operations.