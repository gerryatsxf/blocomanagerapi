# Subscription & Payment System TODO

## ✅ Business Model - FINALIZED

### **Pricing Structure**
- **Free Tier**: Client management (CRUD operations on end-users) + Manual appointments + Google Calendar sync
- **30-Day Trial**: Full access to Starter tier features (no credit card required)
- **Starter Tier**: 99 MXN/month (IVA included)

### **Feature Breakdown**
**Free Tier:**
- ✅ End-user management (create, read, update, delete)
- ✅ Manual appointment creation by tenant admin
- ✅ Google Calendar synchronization
- ❌ No public booking page
- ❌ No automated reminders
- ❌ No end-user self-scheduling

**Starter Tier (Paid):**
- ✅ Everything in Free tier
- ✅ Public booking website (templated UI)
- ✅ Scheduler UI with available time slots
- ✅ End-user self-scheduling capability
- ✅ Optional payment requirement (tenant toggles on/off)
- ✅ Automated appointment reminders

### **Dual Payment System**
1. **Tenant Subscription**: 99 MXN/month → Stripe → Your account
2. **End-User Appointments**: [Tenant-configured fee] → Stripe Connect → Tenant's Stripe account
   - Tenant sets their own price per appointment
   - 16% IVA must be included in tenant's price (stated in T&C)
   - Platform fee: TBD (e.g., 3-5% or flat fee per transaction)

### **Billing Rules**
- ✅ Auto-renewal monthly (cancel anytime)
- ✅ 7-day grace period on payment failure
- ✅ **Upgrade**: Immediate effect, no prorating for MVP
- ✅ **Downgrade**: Scheduled for end of current billing cycle
- ✅ **Expired subscription**: Automatic downgrade to Free tier

### **Tax & Compliance (Mexico - RESICO)**
- ✅ Pricing: 99 MXN final (IVA 16% already included)
- ✅ Currency: MXN only
- ✅ Fiscal data collection: RFC and business info (optional, in tenant settings UI)
- ✅ Invoice storage: 6+ years for compliance
- ❌ No automated CFDI generation (you handle manually)
- ✅ Tenant responsible for issuing CFDIs to their end-users
- ✅ Platform provides transaction records for tenant's accounting

### **Tenant Management**
- ✅ Each tenant (aprendecoding, pedrorivero, etc.) is a separate paying customer
- ✅ Tenant admins can:
  - View subscription status and usage
  - Upgrade/downgrade plans
  - Add/remove payment methods
  - View billing history and download receipts
  - Configure fiscal information (RFC, business name, address)
  - Set appointment pricing for end-users
  - Toggle payment requirement on/off


---

## ✅ Proposed Features - IMPLEMENTATION PHASES

### Phase 1: Core Subscription Infrastructure
**Priority: CRITICAL** ⚡

#### 1.1 Subscription Plans Schema & Management
- [ ] Create `SubscriptionPlan` entity/schema
  - [ ] Plan ID: `free`, `trial`, `starter`
  - [ ] Name: "Free", "Trial", "Starter"
  - [ ] Display name for UI
  - [ ] Pricing: 0 MXN (free), 0 MXN (trial), 99 MXN (starter)
  - [ ] Feature flags (JSON/embedded document):
    ```json
    {
      "clientManagement": true,
      "manualAppointments": true,
      "googleCalendarSync": true,
      "publicBookingPage": false,  // Starter only
      "endUserSelfScheduling": false,  // Starter only
      "automatedReminders": false,  // Starter only
      "endUserPayments": false  // Starter only
    }
    ```
  - [ ] Status: active, archived, deprecated
  - [ ] Trial duration: 30 days (for trial plan)
- [ ] Create `POST /subscription/plans` endpoint (admin/system only)
- [ ] Create `GET /subscription/plans` endpoint (public - show available plans)
- [ ] Create `PATCH /subscription/plans/:id` endpoint (admin only - for price updates)
- [ ] Seed initial plans in database (free, trial, starter)

#### 1.2 Subscription Entity & Lifecycle
- [ ] Create `Subscription` entity/schema
  - [ ] Tenant reference (one-to-one relationship)
  - [ ] Plan reference (free/trial/starter)
  - [ ] Status: `trial`, `active`, `past_due`, `canceled`, `expired`
  - [ ] Current period start/end dates
  - [ ] Auto-renewal flag (default: true)
  - [ ] Stripe customer ID
  - [ ] Stripe subscription ID (for paid plans)
  - [ ] Payment method reference
  - [ ] Billing cycle: monthly only (no annual for MVP)
  - [ ] Trial end date (if status = trial)
  - [ ] Cancellation date (if canceled)
  - [ ] Scheduled plan change (for downgrades at cycle end)
    ```typescript
    {
      scheduledPlanId: 'free',  // Plan to switch to at period end
      scheduledChangeDate: Date,
      scheduledChangeReason: 'downgrade' | 'cancellation'
    }
    ```
- [ ] Create subscription lifecycle service methods:
  - [ ] `createSubscription(tenantId, planId)` - Initial subscription creation
  - [ ] `activateSubscription(subscriptionId)` - Activate after payment
  - [ ] `suspendSubscription(subscriptionId, reason)` - Payment failure or manual suspension
  - [ ] `cancelSubscription(subscriptionId, immediate)` - Cancel immediately or at period end
  - [ ] `reactivateSubscription(subscriptionId)` - Reactivate canceled subscription
  - [ ] `scheduleDowngrade(subscriptionId, targetPlanId)` - Schedule downgrade for cycle end
  - [ ] `executeScheduledChanges()` - Cron job to apply scheduled changes

#### 1.3 Tenant-Subscription Linking
- [ ] Add `subscriptionId` reference to Tenant entity
- [ ] Add `stripeCustomerId` to Tenant entity (for subscription billing)
- [ ] Add `stripeConnectAccountId` to Tenant entity (for end-user payments)
- [ ] Update tenant registration flow:
  - [ ] Automatically create 30-day trial subscription on registration
  - [ ] Create Stripe customer for tenant
  - [ ] No credit card required for trial
- [ ] Ensure tenant sessions validate subscription status
  - [ ] Add subscription status to session context
  - [ ] Middleware to check subscription before protected routes

#### 1.4 Fiscal Information Collection
- [ ] Create `FiscalInfo` entity/schema (embedded in Tenant or separate collection)
  - [ ] RFC (Registro Federal de Contribuyentes)
  - [ ] Legal business name (Razón Social)
  - [ ] Business address (street, city, state, postal code)
  - [ ] Tax regime (default: RESICO for small businesses)
  - [ ] Optional fields for CFDI generation
- [ ] Create `POST /tenant/fiscal-info` endpoint (authenticated tenant admin)
- [ ] Create `GET /tenant/fiscal-info` endpoint
- [ ] Create `PATCH /tenant/fiscal-info` endpoint
- [ ] Validation: RFC format (13 characters for companies, 12-13 for individuals)

---

### Phase 2: Stripe Integration (Dual Payment System)
**Priority: CRITICAL** ⚡

#### 2.1 Stripe SDK Setup
- [ ] Install Stripe SDK: `npm install stripe @stripe/stripe-js`
- [ ] Configure Stripe API keys in environment variables
  - [ ] `STRIPE_SECRET_KEY` (test mode initially)
  - [ ] `STRIPE_PUBLISHABLE_KEY`
  - [ ] `STRIPE_WEBHOOK_SECRET`
- [ ] Create StripeService injectable
- [ ] Configure test mode vs production mode based on env

#### 2.2 Subscription Payments (Platform Revenue)
**Tenant pays you 99 MXN/month**

- [ ] Create Stripe Customer on tenant registration
  - [ ] Link Stripe customer ID to tenant record
  - [ ] Set customer metadata: tenantId, email
- [ ] Create `POST /subscription/checkout` endpoint
  - [ ] Create Stripe Checkout Session for subscription
  - [ ] Mode: `subscription`
  - [ ] Price: 99 MXN/month (create Stripe Price object)
  - [ ] Trial period: 30 days (Stripe handles trial automatically)
  - [ ] Success/cancel URLs for frontend redirect
  - [ ] Return checkout session URL
- [ ] Create `GET /subscription/payment-methods` endpoint
  - [ ] List tenant's saved payment methods from Stripe
- [ ] Create `POST /subscription/payment-methods` endpoint
  - [ ] Add new payment method via Stripe SetupIntent
- [ ] Create `DELETE /subscription/payment-methods/:id` endpoint
  - [ ] Detach payment method from Stripe customer
- [ ] Create `PATCH /subscription/payment-methods/:id/default` endpoint
  - [ ] Set default payment method for subscription

#### 2.3 Stripe Connect (End-User Payments to Tenant)
**End-users pay tenants for appointments**

- [ ] Set up Stripe Connect account type: **Standard Connect** (recommended)
  - Standard Connect: Tenant creates their own Stripe account, full control
  - Alternative: Express Connect (simpler, less control for tenant)
- [ ] Create `POST /tenant/stripe-connect/onboard` endpoint
  - [ ] Create Stripe Connect account for tenant
  - [ ] Generate onboarding link (Stripe hosted onboarding)
  - [ ] Return onboarding URL for frontend redirect
  - [ ] Store `stripeConnectAccountId` in tenant record
- [ ] Create `GET /tenant/stripe-connect/status` endpoint
  - [ ] Check if tenant has completed Stripe Connect onboarding
  - [ ] Return: `not_started`, `pending`, `complete`
  - [ ] Check if charges_enabled and payouts_enabled
- [ ] Create `POST /tenant/stripe-connect/refresh` endpoint
  - [ ] Generate new onboarding link if tenant didn't complete
- [ ] Create `GET /tenant/stripe-connect/dashboard` endpoint
  - [ ] Generate Stripe Connect dashboard login link for tenant
  - [ ] Allows tenant to view their earnings, payouts, disputes
- [ ] Add `requiresPayment` toggle to Tenant settings schema
  - [ ] Boolean flag: tenant can enable/disable payment requirement
  - [ ] Only available if Stripe Connect is set up
- [ ] Add `appointmentPrice` to Tenant settings schema
  - [ ] Fixed price in MXN (tenant configures)
  - [ ] Example: 200 MXN per appointment
  - [ ] Price must include 16% IVA (stated in T&C)

#### 2.4 Appointment Payment Processing (When End-User Books)
- [ ] Create `POST /booking/checkout` endpoint (public, for end-users)
  - [ ] Requires: tenantId, appointmentDetails
  - [ ] Check if tenant has `requiresPayment` enabled
  - [ ] If yes, create Stripe Checkout Session:
    - [ ] Mode: `payment` (one-time payment)
    - [ ] Amount: tenant's `appointmentPrice` in MXN
    - [ ] Destination: tenant's `stripeConnectAccountId`
    - [ ] Application fee: TBD (e.g., 5% platform fee)
    - [ ] Metadata: appointmentId, tenantId, endUserId
  - [ ] Return checkout session URL
  - [ ] Appointment status: `pending_payment`
- [ ] Update appointment status on payment success (via webhook)
  - [ ] `pending_payment` → `confirmed`

#### 2.5 Stripe Webhooks
- [ ] Create `POST /subscription/webhook` endpoint (public, Stripe calls this)
  - [ ] Verify webhook signature using `STRIPE_WEBHOOK_SECRET`
  - [ ] Handle subscription payment events:
    - [ ] `checkout.session.completed` - Trial converted to paid
    - [ ] `invoice.paid` - Monthly subscription payment successful
    - [ ] `invoice.payment_failed` - Payment failed, mark subscription as `past_due`
    - [ ] `customer.subscription.updated` - Subscription status changed
    - [ ] `customer.subscription.deleted` - Subscription canceled in Stripe
  - [ ] Handle Connect onboarding events:
    - [ ] `account.updated` - Connect account onboarding status changed
  - [ ] Handle end-user payment events:
    - [ ] `checkout.session.completed` - End-user paid for appointment
    - [ ] `charge.succeeded` - Charge to connected account succeeded
    - [ ] `charge.failed` - Charge failed
- [ ] Create webhook event logging for debugging
  - [ ] Store all webhook events in `StripeWebhookLog` collection
  - [ ] Log: event type, event ID, processed status, timestamp
- [ ] Implement idempotency for webhook handling
  - [ ] Check if event was already processed using event ID
  - [ ] Prevent duplicate processing

---

### Phase 3: Subscription Management API
**Priority: HIGH** 🔥

#### 3.1 Tenant Self-Service Dashboard
- [ ] Create `GET /subscription/current` endpoint
  - [ ] Return current subscription details:
    ```json
    {
      "planId": "starter",
      "planName": "Starter",
      "status": "active",
      "price": 99,
      "currency": "MXN",
      "currentPeriodStart": "2025-01-01",
      "currentPeriodEnd": "2025-02-01",
      "trialEndDate": null,
      "autoRenew": true,
      "scheduledChange": null,
      "daysRemaining": 15
    }
    ```
  - [ ] Include next billing date
  - [ ] Include payment method info (last 4 digits, brand)
  - [ ] Show if there's a scheduled downgrade
- [ ] Create `POST /subscription/upgrade` endpoint
  - [ ] Upgrade from free/trial to starter (99 MXN)
  - [ ] Effect: **Immediate** (no prorating for MVP)
  - [ ] Redirect to Stripe Checkout for payment setup
  - [ ] Update subscription status to `active` after payment
- [ ] Create `POST /subscription/downgrade` endpoint
  - [ ] Downgrade from starter to free
  - [ ] Effect: **Scheduled for end of current billing cycle**
  - [ ] Set `scheduledPlanId` = 'free'
  - [ ] Set `scheduledChangeDate` = current period end date
  - [ ] Subscription remains active until period ends
  - [ ] Display warning: "Your subscription will downgrade to Free on [date]"
- [ ] Create `POST /subscription/cancel` endpoint
  - [ ] Cancel subscription (downgrade to free at period end)
  - [ ] Optional: `immediate` flag for instant cancellation (no refund)
  - [ ] Track cancellation reason (optional survey)
  - [ ] Default: Cancel at period end
  - [ ] Send cancellation confirmation email
- [ ] Create `POST /subscription/reactivate` endpoint
  - [ ] Reactivate a canceled subscription before period ends
  - [ ] Cancel the scheduled downgrade
  - [ ] Only works if subscription is still in current billing period
- [ ] Create `POST /subscription/undo-downgrade` endpoint
  - [ ] Cancel a scheduled downgrade
  - [ ] Remove `scheduledPlanId` and `scheduledChangeDate`

#### 3.2 Billing History & Transaction Records
- [ ] Create `Transaction` entity/schema (for audit trail)
  - [ ] Tenant reference
  - [ ] Type: `subscription_payment`, `appointment_payment`, `refund`, `platform_fee`
  - [ ] Amount, currency (MXN)
  - [ ] Stripe charge ID or invoice ID
  - [ ] Status: `pending`, `succeeded`, `failed`, `refunded`
  - [ ] Description (e.g., "Monthly subscription - Starter plan")
  - [ ] Metadata: JSON object with additional info
  - [ ] Created timestamp
- [ ] Create `GET /subscription/transactions` endpoint
  - [ ] List all tenant's subscription transactions
  - [ ] Pagination and filtering (date range, type, status)
  - [ ] For tenant admin to view payment history
- [ ] Create `GET /subscription/transactions/:id` endpoint
  - [ ] Get details of a specific transaction
  - [ ] Include Stripe receipt URL
- [ ] Store 6+ years for Mexican tax compliance
  - [ ] No automatic deletion of transaction records
  - [ ] Add archiving strategy after 2-3 years (move to cold storage)

#### 3.3 Tenant Appointment Payment Settings
- [ ] Create `GET /tenant/payment-settings` endpoint
  - [ ] Return current settings:
    ```json
    {
      "requiresPayment": true,
      "appointmentPrice": 200,
      "currency": "MXN",
      "stripeConnectStatus": "complete",
      "canAcceptPayments": true
    }
    ```
- [ ] Create `PATCH /tenant/payment-settings` endpoint
  - [ ] Update `requiresPayment` toggle (true/false)
  - [ ] Update `appointmentPrice` (must be > 0)
  - [ ] Validation: Can only enable if Stripe Connect is set up
  - [ ] Validation: Must have Starter plan or trial to enable payments
  - [ ] Price must include IVA (displayed in UI: "Price includes 16% IVA")

---

### Phase 4: Feature Gating & Access Control
**Priority: HIGH** 🔥

#### 4.1 Feature Flags System
- [ ] Create `Feature` enum with all features:
  ```typescript
  enum Feature {
    // Free tier features
    CLIENT_MANAGEMENT = 'client_management',
    MANUAL_APPOINTMENTS = 'manual_appointments',
    GOOGLE_CALENDAR_SYNC = 'google_calendar_sync',
    
    // Starter tier features (paid)
    PUBLIC_BOOKING_PAGE = 'public_booking_page',
    END_USER_SELF_SCHEDULING = 'end_user_self_scheduling',
    AUTOMATED_REMINDERS = 'automated_reminders',
    END_USER_PAYMENTS = 'end_user_payments',
  }
  ```
- [ ] Create `FeatureAccessGuard` (NestJS guard)
  - [ ] Checks tenant's subscription plan
  - [ ] Validates if plan includes requested feature
  - [ ] Returns 403 Forbidden if access denied
  - [ ] Error message: "This feature requires Starter plan. Upgrade to continue."
- [ ] Create `@RequireFeature()` decorator
  ```typescript
  @Post('/booking/public')
  @RequireFeature(Feature.PUBLIC_BOOKING_PAGE)
  async createPublicBooking() { ... }
  ```
- [ ] Create `SubscriptionService.hasFeature(tenantId, feature)` method
  - [ ] Query subscription plan for tenant
  - [ ] Check if plan's feature flags include the feature
  - [ ] Handle trial: Trial has same features as Starter
  - [ ] Handle expired subscriptions: Defaults to free tier features

#### 4.2 Frontend Feature Visibility
- [ ] Create `GET /subscription/features` endpoint
  - [ ] Return list of features available to current tenant
  - [ ] Frontend uses this to show/hide UI elements
  ```json
  {
    "available": ["client_management", "manual_appointments", "google_calendar_sync"],
    "unavailable": ["public_booking_page", "end_user_self_scheduling", "automated_reminders"],
    "plan": "free"
  }
  ```
- [ ] Include upgrade prompt in responses when feature is unavailable
  ```json
  {
    "error": "Feature not available",
    "feature": "public_booking_page",
    "requiredPlan": "starter",
    "upgradeUrl": "/subscription/upgrade"
  }
  ```

#### 4.3 Usage Limits (Future Enhancement)
For MVP, no hard limits. Add later if needed:
- [ ] Track appointment count per tenant per month
- [ ] Track end-user count per tenant
- [ ] Add soft limits with email alerts (e.g., 1000 appointments/month)

---

### Phase 5: Trial Management & Automation
**Priority: MEDIUM** ⚙️

#### 5.1 Free Trial Flow
- [ ] On tenant registration:
  - [ ] Automatically create subscription with plan = `trial`
  - [ ] Set `trialEndDate` = registration date + 30 days
  - [ ] Set `status` = 'trial'
  - [ ] No credit card required
  - [ ] Full access to Starter features
- [ ] Create trial reminder email templates:
  - [ ] **Day 23** (7 days remaining): "Your trial ends in 7 days"
  - [ ] **Day 27** (3 days remaining): "Only 3 days left in your trial"
  - [ ] **Day 29** (1 day remaining): "Last day of your trial!"
  - [ ] **Day 30** (expired): "Your trial has ended. Upgrade to continue using paid features."
- [ ] Send reminder emails via existing NotificationService
- [ ] Create `GET /subscription/trial-status` endpoint
  - [ ] Return days remaining in trial
  - [ ] Return if trial is expiring soon (< 7 days)

#### 5.2 Trial Expiration Automation
- [ ] Create cron job: `@Cron('0 0 * * *')` (runs daily at midnight)
  - [ ] Query all subscriptions where:
    - `status = 'trial'`
    - `trialEndDate <= today`
  - [ ] For each expired trial:
    - [ ] Check if tenant added payment method during trial
    - [ ] If YES: Convert to `active` subscription (Stripe handles this)
    - [ ] If NO: Downgrade to `free` plan
      - Set `planId = 'free'`
      - Set `status = 'expired'`
      - Revoke access to paid features
    - [ ] Send trial expiration email
    - [ ] Log trial conversion metrics (converted vs expired)

#### 5.3 Trial to Paid Conversion
- [ ] Tenant adds payment method during trial → Automatic conversion
  - [ ] Stripe subscription with trial period already set up
  - [ ] When trial ends, Stripe automatically charges first payment
  - [ ] Webhook `invoice.paid` updates subscription status to `active`
- [ ] Manual conversion: `POST /subscription/convert-trial` endpoint
  - [ ] Redirect to Stripe Checkout with trial discount (if applicable)
  - [ ] Immediately activate Starter plan after payment
  - [ ] Send welcome to paid tier email

---

### Phase 6: Failed Payment Handling & Grace Period
**Priority: MEDIUM** ⚙️

#### 6.1 Payment Failure Flow
- [ ] Webhook: `invoice.payment_failed` event
  - [ ] Update subscription status to `past_due`
  - [ ] Set grace period end date = failure date + 7 days
  - [ ] Keep paid features ENABLED during grace period
  - [ ] Send immediate payment failure email to tenant admin
    - Subject: "Payment Failed - Please Update Payment Method"
    - Include link to update payment method
    - Mention 7-day grace period

#### 6.2 Smart Retry Logic (Stripe handles this)
- [ ] Stripe automatically retries failed payments
  - [ ] Day 3: First retry
  - [ ] Day 5: Second retry
  - [ ] Day 7: Final retry
- [ ] Send reminder emails:
  - [ ] **Day 3**: "Payment retry in progress"
  - [ ] **Day 5**: "2 days remaining to update payment"
  - [ ] **Day 7**: "Final day - Subscription will be canceled"

#### 6.3 Grace Period Expiration
- [ ] Cron job: Check subscriptions in `past_due` status daily
  - [ ] If grace period expired (7 days passed):
    - [ ] Downgrade to `free` plan
    - [ ] Revoke access to paid features
    - [ ] Set `status = 'canceled'`
    - [ ] Send subscription suspended email
    - [ ] Tenant can reactivate by updating payment method

#### 6.4 Payment Recovery
- [ ] Create `POST /subscription/retry-payment` endpoint
  - [ ] Manually trigger Stripe payment retry
  - [ ] Tenant can click "Retry Payment" in dashboard
- [ ] Webhook: `invoice.paid` after recovery
  - [ ] Update subscription status back to `active`
  - [ ] Reset grace period
  - [ ] Send payment successful email

---

### Phase 7: Admin Tools & Monitoring
**Priority: LOW** 📊

#### 7.1 Platform Admin Dashboard APIs
- [ ] Create admin-only endpoints (protected by AdminGuard)
- [ ] `GET /admin/subscriptions` endpoint
  - [ ] List all subscriptions across all tenants
  - [ ] Filters: plan, status, date range
  - [ ] Pagination, sorting
  - [ ] Search by tenant name/email
- [ ] `GET /admin/subscriptions/metrics` endpoint
  - [ ] **MRR** (Monthly Recurring Revenue): Count of active Starter subscriptions × 99 MXN
  - [ ] **ARR** (Annual Recurring Revenue): MRR × 12
  - [ ] **Churn rate**: Canceled subscriptions / Total active subscriptions
  - [ ] Active subscriptions by plan (free, trial, starter)
  - [ ] Trial conversion rate: (Paid conversions / Total trials) × 100
  - [ ] Total revenue this month
- [ ] `POST /admin/subscriptions/:id/override` endpoint
  - [ ] Manually extend trial (add X days)
  - [ ] Manually activate/suspend subscription
  - [ ] Apply credits or discounts
  - [ ] Grant temporary feature access
  - [ ] Audit log all manual changes

#### 7.2 Transaction & Revenue Tracking
- [ ] `GET /admin/transactions` endpoint
  - [ ] All transactions across all tenants
  - [ ] Filter by type, status, date range
  - [ ] Export to CSV for accounting
- [ ] `GET /admin/revenue/summary` endpoint
  - [ ] Total platform revenue (subscription fees)
  - [ ] Total appointment payment volume (passing through Connect)
  - [ ] Platform fees earned from Connect transactions
  - [ ] Revenue by month/quarter/year

#### 7.3 Stripe Connect Monitoring
- [ ] `GET /admin/stripe-connect/accounts` endpoint
  - [ ] List all tenant Stripe Connect accounts
  - [ ] Status: pending, active, restricted, disabled
  - [ ] Identify tenants with onboarding issues
- [ ] `GET /admin/stripe-connect/disputes` endpoint
  - [ ] List all disputes/chargebacks from end-user payments
  - [ ] Notify affected tenants

---

### Phase 8: Advanced Features (Future)
- [ ] Track conversion metrics
- [ ] Send welcome to paid tier email

---

### Phase 6: Admin & Monitoring
**Priority: MEDIUM**

#### 6.1 Admin Dashboard APIs
- [ ] Create `GET /admin/subscriptions` endpoint
  - [ ] List all subscriptions with filters
  - [ ] Filter by status, plan, tenant
  - [ ] Pagination and sorting
- [ ] Create `GET /admin/subscriptions/metrics` endpoint
  - [ ] MRR (Monthly Recurring Revenue)
  - [ ] ARR (Annual Recurring Revenue)
  - [ ] Churn rate
  - [ ] Active subscriptions by plan
  - [ ] Trial conversion rate
- [ ] Create `POST /admin/subscriptions/:id/override` endpoint
  - [ ] Manually extend trial
  - [ ] Manually activate/suspend
  - [ ] Apply discounts/credits
  - [ ] Grant temporary feature access

#### 6.2 Failed Payment Recovery
- [ ] Create payment retry logic
  - [ ] Retry failed payments automatically (Smart retry: day 1, 3, 5, 7)
- [ ] Create dunning management
  - [ ] Send payment failure email immediately
  - [ ] Send reminder emails (day 3, 7)
  - [ ] Suspend subscription after grace period
- [ ] Create `GET /subscription/payment-status` endpoint
  - [ ] Show payment issues to tenant admin
  - [ ] Allow updating payment method
- [ ] Create grace period configuration per plan

---

### Phase 7: Advanced Features
**Priority: LOW**

#### 7.1 Proration & Credits
- [ ] Implement proration calculation service
  - [ ] Calculate unused time on current plan
  - [ ] Calculate charges for upgrade
  - [ ] Calculate credits for downgrade
- [ ] Create `Credit` entity/schema
  - [ ] Tenant reference
  - [ ] Amount, currency
  - [ ] Source (downgrade, refund, manual)
  - [ ] Used/remaining amount
  - [ ] Expiration date
- [ ] Apply credits automatically on next invoice

#### 7.2 Discounts & Promotions
- [ ] Create `Coupon` entity/schema
  - [ ] Code, description
  - [ ] Discount type (percentage, fixed amount)
  - [ ] Discount value
  - [ ] Duration (once, forever, repeating)
  - [ ] Expiration date
  - [ ] Usage limits
- [ ] Create `POST /subscription/apply-coupon` endpoint
- [ ] Validate coupon on checkout
- [ ] Track coupon usage

#### 7.3 Multi-Currency Support
- [ ] Add currency field to subscriptions and invoices
- [ ] Integrate currency conversion API (if needed)
- [ ] Display prices in tenant's preferred currency
- [ ] Handle tax calculations per region

#### 7.4 Enterprise Features
- [ ] Create custom contract support
  - [ ] Manual invoice generation
  - [ ] Custom payment terms
  - [ ] Custom SLA
- [ ] Create purchase order (PO) support
- [ ] Create multi-tenant billing (parent account)
  - [ ] One organization pays for multiple tenants
  - [ ] Consolidated invoicing

#### 7.5 Webhooks for Tenants
- [ ] Create tenant webhook configuration
  - [ ] Allow tenants to register webhook URLs
  - [ ] Trigger webhooks on subscription events
  - [ ] `subscription.activated`
  - [ ] `subscription.renewed`
  - [ ] `subscription.canceled`
  - [ ] `payment.succeeded`
  - [ ] `payment.failed`

---

## 🔧 Technical Implementation Details

### Database Schema Relationships
```
Tenant
  ├── stripeCustomerId (for subscription billing)
  ├── stripeConnectAccountId (for receiving end-user payments)
  ├── subscriptionId → Subscription
  └── fiscalInfo (embedded or referenced)
        ├── rfc
        ├── legalBusinessName
        ├── businessAddress
        └── taxRegime

Subscription
  ├── tenantId → Tenant
  ├── planId → SubscriptionPlan
  ├── status: trial | active | past_due | canceled | expired
  ├── stripeSubscriptionId
  ├── currentPeriodStart
  ├── currentPeriodEnd
  ├── trialEndDate
  ├── scheduledPlanId (for downgrades)
  └── scheduledChangeDate

SubscriptionPlan
  ├── planId: free | trial | starter
  ├── name: Free | Trial | Starter
  ├── price: 0 | 0 | 99 (MXN)
  ├── features: JSON object
  └── status: active | archived

Transaction (Audit Log)
  ├── tenantId → Tenant
  ├── type: subscription_payment | appointment_payment | refund
  ├── amount, currency
  ├── stripeChargeId or stripeInvoiceId
  ├── status: pending | succeeded | failed
  └── metadata: JSON

TenantPaymentSettings (embedded in Tenant or separate)
  ├── requiresPayment: boolean
  ├── appointmentPrice: number (MXN)
  └── stripeConnectStatus: not_started | pending | complete
```

### Subscription State Machine
```
[New Tenant Registration]
    │
    ├─→ [Trial] (30 days, full Starter features)
    │     │
    │     ├─→ [Active] (payment added before trial ends)
    │     │     │
    │     │     ├─→ [Past Due] (payment failed)
    │     │     │     │
    │     │     │     ├─→ [Active] (payment recovered within 7 days)
    │     │     │     └─→ [Canceled] → [Free] (grace period expired)
    │     │     │
    │     │     └─→ [Canceled] (tenant cancels)
    │     │           └─→ [Free] (at period end)
    │     │
    │     └─→ [Expired] → [Free] (trial ended, no payment)
    │
    └─→ [Active] (immediate paid subscription, skip trial)
          └─→ (same flow as above)
```

### Feature Gating Logic
```typescript
// Example: Check if tenant can access public booking page
async canAccessFeature(tenantId: string, feature: Feature): Promise<boolean> {
  const subscription = await this.getActiveSubscription(tenantId);
  
  // Handle expired/canceled → defaults to free plan
  const effectivePlan = subscription.status === 'active' || subscription.status === 'trial'
    ? subscription.plan
    : await this.getPlan('free');
  
  return effectivePlan.features[feature] === true;
}

// Usage in controller
@Post('/booking/public')
@RequireFeature(Feature.PUBLIC_BOOKING_PAGE)
async createPublicBooking(@TenantId() tenantId: string, @Body() dto: CreateBookingDto) {
  // If tenant doesn't have Starter or Trial, guard throws 403
  return this.bookingService.createPublicBooking(tenantId, dto);
}
```

### Stripe Webhook Signature Verification
```typescript
@Post('webhook')
@Header('Content-Type', 'application/json')
async handleStripeWebhook(@Req() req: RawBodyRequest<Request>) {
  const sig = req.headers['stripe-signature'];
  const webhookSecret = this.configService.get('STRIPE_WEBHOOK_SECRET');
  
  let event: Stripe.Event;
  
  try {
    event = this.stripe.webhooks.constructEvent(
      req.rawBody,  // Raw body buffer required
      sig,
      webhookSecret
    );
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    throw new BadRequestException('Invalid signature');
  }
  
  // Check if event was already processed (idempotency)
  const alreadyProcessed = await this.checkEventProcessed(event.id);
  if (alreadyProcessed) {
    return { received: true, status: 'already_processed' };
  }
  
  // Handle event based on type
  switch (event.type) {
    case 'invoice.paid':
      await this.handleInvoicePaid(event.data.object);
      break;
    case 'invoice.payment_failed':
      await this.handlePaymentFailed(event.data.object);
      break;
    case 'customer.subscription.deleted':
      await this.handleSubscriptionDeleted(event.data.object);
      break;
    // ... more event handlers
  }
  
  // Mark event as processed
  await this.markEventProcessed(event.id);
  
  return { received: true };
}
```

### Stripe Connect Account Creation
```typescript
async createConnectAccount(tenantId: string): Promise<string> {
  const tenant = await this.tenantService.findById(tenantId);
  
  // Create Stripe Connect account (Standard Connect)
  const account = await this.stripe.accounts.create({
    type: 'standard',  // Tenant creates their own Stripe account
    country: 'MX',     // Mexico
    email: tenant.email,
    capabilities: {
      card_payments: { requested: true },
      transfers: { requested: true },
    },
    metadata: {
      tenantId: tenant.id,
      tenantName: tenant.name,
    },
  });
  
  // Save Connect account ID to tenant
  tenant.stripeConnectAccountId = account.id;
  await this.tenantService.update(tenant);
  
  // Generate onboarding link
  const accountLink = await this.stripe.accountLinks.create({
    account: account.id,
    refresh_url: `${this.frontendUrl}/settings/payments/onboarding`,
    return_url: `${this.frontendUrl}/settings/payments/success`,
    type: 'account_onboarding',
  });
  
  return accountLink.url;  // Frontend redirects tenant here
}
```

### End-User Appointment Payment (Connect)
```typescript
async createAppointmentCheckout(
  tenantId: string,
  appointmentDetails: AppointmentDetails
): Promise<string> {
  const tenant = await this.tenantService.findById(tenantId);
  
  // Verify tenant has Connect account and payments enabled
  if (!tenant.stripeConnectAccountId) {
    throw new BadRequestException('Tenant has not set up payments');
  }
  
  if (!tenant.paymentSettings.requiresPayment) {
    throw new BadRequestException('Tenant has disabled payment requirement');
  }
  
  // Create checkout session
  // Payment goes to tenant's Connect account
  const session = await this.stripe.checkout.sessions.create({
    mode: 'payment',
    payment_method_types: ['card'],
    line_items: [{
      price_data: {
        currency: 'mxn',
        unit_amount: tenant.paymentSettings.appointmentPrice * 100,  // Stripe uses cents
        product_data: {
          name: 'Appointment Booking',
          description: `Appointment with ${tenant.name}`,
        },
      },
      quantity: 1,
    }],
    payment_intent_data: {
      application_fee_amount: this.calculatePlatformFee(tenant.paymentSettings.appointmentPrice),  // Platform fee
      transfer_data: {
        destination: tenant.stripeConnectAccountId,  // Money goes to tenant
      },
      metadata: {
        tenantId: tenant.id,
        appointmentId: appointmentDetails.id,
      },
    },
    success_url: `${this.frontendUrl}/booking/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${this.frontendUrl}/booking/cancel`,
    metadata: {
      tenantId: tenant.id,
      appointmentId: appointmentDetails.id,
    },
  });
  
  return session.url;  // End-user is redirected here to pay
}

calculatePlatformFee(appointmentPrice: number): number {
  // Example: 5% platform fee
  // If appointment is 200 MXN, platform keeps 10 MXN, tenant gets 190 MXN
  const feePercentage = 0.05;
  return Math.round(appointmentPrice * feePercentage * 100);  // In cents
}
```

---

## 🧪 Testing Strategy

### Unit Tests
- [ ] `SubscriptionService` methods:
  - [ ] `createSubscription()` - Creates trial on tenant registration
  - [ ] `activateSubscription()` - Activates after payment
  - [ ] `scheduleDowngrade()` - Schedules downgrade correctly
  - [ ] `executeScheduledChanges()` - Applies scheduled changes
- [ ] `FeatureAccessGuard`:
  - [ ] Allows access for correct plans
  - [ ] Blocks access for insufficient plans
  - [ ] Handles trial = starter features
- [ ] Stripe webhook handlers:
  - [ ] Mock Stripe events
  - [ ] Test idempotency (duplicate event handling)

### Integration Tests
- [ ] End-to-end subscription flow:
  1. Register tenant → Trial created
  2. Trial expires without payment → Downgrade to free
  3. Add payment during trial → Convert to active
  4. Upgrade from free to starter → Payment processed
  5. Downgrade from starter to free → Scheduled for period end
  6. Payment fails → Grace period → Recovery
- [ ] Stripe Connect flow:
  1. Create Connect account for tenant
  2. Complete onboarding (mock)
  3. End-user makes appointment payment
  4. Verify payment reaches tenant account
  5. Verify platform fee is collected
- [ ] Feature gating:
  1. Free tenant tries to access booking page → 403 Forbidden
  2. Starter tenant accesses booking page → Success
  3. Trial tenant accesses booking page → Success

### E2E Tests (Stripe Test Mode)
- [ ] Use Stripe test card numbers: `4242 4242 4242 4242`
- [ ] Test webhook delivery with Stripe CLI: `stripe listen --forward-to localhost:3000/subscription/webhook`
- [ ] Test failed payment: Use card `4000 0000 0000 0341`
- [ ] Test Connect onboarding in Stripe test mode

---

## 🚀 Deployment Checklist

### Environment Variables
```bash
# Stripe (Test Mode for development)
STRIPE_SECRET_KEY=sk_test_...
STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Stripe (Production)
STRIPE_SECRET_KEY=sk_live_...
STRIPE_PUBLISHABLE_KEY=pk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Subscription Config
SUBSCRIPTION_TRIAL_DAYS=30
SUBSCRIPTION_GRACE_PERIOD_DAYS=7
SUBSCRIPTION_STARTER_PRICE_MXN=99

# Frontend URLs (for Stripe redirects)
FRONTEND_URL=https://yourdomain.com
```

### Stripe Configuration Steps
1. **Create Stripe Account** (if not already done)
   - Sign up at stripe.com
   - Complete business verification for Mexico

2. **Create Products & Prices in Stripe Dashboard**
   - Product: "Starter Plan"
   - Price: 99 MXN/month recurring
   - Save Price ID to environment config

3. **Enable Stripe Connect**
   - Go to Stripe Dashboard → Connect
   - Enable "Standard" Connect type
   - Set platform name and branding

4. **Configure Webhooks**
   - Go to Developers → Webhooks
   - Add endpoint: `https://yourdomain.com/subscription/webhook`
   - Select events to listen:
     - `invoice.paid`
     - `invoice.payment_failed`
     - `customer.subscription.updated`
     - `customer.subscription.deleted`
     - `checkout.session.completed`
     - `account.updated` (for Connect)
   - Copy webhook secret to env variables

5. **Test Mode Setup**
   - Use test API keys for development
   - Use Stripe CLI for local webhook testing:
     ```bash
     stripe login
     stripe listen --forward-to localhost:3000/subscription/webhook
     ```

### Database Indexes (MongoDB)
```typescript
// Subscription collection
db.subscriptions.createIndex({ tenantId: 1 }, { unique: true });
db.subscriptions.createIndex({ status: 1 });
db.subscriptions.createIndex({ trialEndDate: 1 });
db.subscriptions.createIndex({ scheduledChangeDate: 1 });

// Transaction collection
db.transactions.createIndex({ tenantId: 1, createdAt: -1 });
db.transactions.createIndex({ type: 1, status: 1 });
db.transactions.createIndex({ stripeChargeId: 1 }, { unique: true, sparse: true });

// SubscriptionPlan collection
db.subscriptionPlans.createIndex({ planId: 1 }, { unique: true });
db.subscriptionPlans.createIndex({ status: 1 });

// Tenant collection (add new indexes)
db.tenants.createIndex({ stripeCustomerId: 1 }, { unique: true, sparse: true });
db.tenants.createIndex({ stripeConnectAccountId: 1 }, { unique: true, sparse: true });
```

### Cron Jobs Setup
- [ ] Add `@nestjs/schedule` package
- [ ] Enable cron jobs in production only (check NODE_ENV)
- [ ] Trial expiration job: Runs daily at 00:00 UTC
- [ ] Grace period expiration job: Runs daily at 00:00 UTC
- [ ] Scheduled plan changes job: Runs daily at 00:00 UTC
- [ ] Monitoring: Log cron job execution and results

### Monitoring & Alerts
- [ ] Set up error tracking (Sentry, LogRocket)
- [ ] Monitor webhook delivery failures
- [ ] Alert on:
  - High payment failure rate (> 10%)
  - Webhook processing errors
  - Trial conversion rate drops below threshold
  - Stripe API errors
- [ ] Dashboard metrics:
  - MRR/ARR
  - Active subscriptions by plan
  - Trial conversion rate
  - Churn rate

---

## 📝 Migration Plan for Existing Tenants

### Step 1: Communication
- [ ] Announce subscription feature 2 weeks before launch
- [ ] Email existing tenants explaining:
  - New free tier (existing features preserved)
  - New paid tier (additional features)
  - Existing tenants get 60-day grandfathered trial (double the normal trial)
  - No immediate action required

### Step 2: Data Migration Script
```typescript
async migrateExistingTenants() {
  const existingTenants = await this.tenantService.findAll();
  
  for (const tenant of existingTenants) {
    // Check if tenant already has subscription
    const existingSubscription = await this.subscriptionService.findByTenantId(tenant.id);
    if (existingSubscription) continue;
    
    // Create 60-day trial for existing tenants
    await this.subscriptionService.createSubscription({
      tenantId: tenant.id,
      planId: 'trial',
      trialEndDate: addDays(new Date(), 60),  // 60 days instead of 30
      status: 'trial',
    });
    
    // Send migration email
    await this.notificationService.sendEmail({
      to: tenant.email,
      subject: 'Important: New subscription plans available',
      template: 'subscription-migration',
      data: { trialDays: 60, tenant },
    });
  }
}
```

### Step 3: Gradual Rollout
- [ ] **Week 1**: Enable subscription system, all tenants on extended trial
- [ ] **Week 2-8**: 60-day trial period for existing tenants
- [ ] **Week 6**: Send reminders about trial ending soon
- [ ] **Week 9**: Trial expires, tenants choose free or paid tier

---

## 📊 Success Metrics & KPIs

### Business Metrics
- **MRR (Monthly Recurring Revenue)**: Target 100,000 MXN/month in first 6 months
- **Trial Conversion Rate**: Target >20% (trial → paid)
- **Churn Rate**: Target <5% monthly
- **Customer Lifetime Value (CLV)**: Target >12 months average subscription length
- **Average Revenue Per User (ARPU)**: 99 MXN (single tier for MVP)

### Technical Metrics
- **Webhook Success Rate**: >99.5%
- **Payment Success Rate**: >90% (excluding intentional test failures)
- **Subscription API Response Time**: <500ms p95
- **Feature Gate Check Performance**: <50ms p95
- **Failed Payment Recovery Rate**: >30%

### Product Metrics
- **Feature Adoption**: % of Starter subscribers using each feature
  - Public booking page usage
  - End-user payment enablement rate
  - Automated reminder usage
- **Upgrade Rate**: % of free users who upgrade to Starter
- **Downgrade Rate**: % of Starter users who downgrade to Free

---

## 🎯 MVP Quick-Start Implementation Order

**Priority 1 (Week 1-2): Core Foundation**
1. ✅ Create `SubscriptionPlan` schema + seed data (free, trial, starter)
2. ✅ Create `Subscription` schema with tenant relationship
3. ✅ Stripe SDK setup + environment config
4. ✅ Auto-create trial subscription on tenant registration
5. ✅ Feature gating guard + `@RequireFeature()` decorator

**Priority 2 (Week 3-4): Payment Integration**
6. ✅ Stripe Checkout for subscription (trial → paid)
7. ✅ Stripe webhook endpoint with signature verification
8. ✅ Handle key events: `invoice.paid`, `invoice.payment_failed`, `customer.subscription.deleted`
9. ✅ Payment method management endpoints (add, list, set default)
10. ✅ `GET /subscription/current` endpoint (tenant dashboard)

**Priority 3 (Week 5-6): Stripe Connect for End-User Payments**
11. ✅ Stripe Connect account creation for tenants
12. ✅ Onboarding flow (generate account link, track completion)
13. ✅ Tenant payment settings: `requiresPayment`, `appointmentPrice`
14. ✅ End-user appointment checkout (payment to tenant's Connect account)
15. ✅ Platform fee calculation and collection

**Priority 4 (Week 7-8): Self-Service & Lifecycle**
16. ✅ Upgrade endpoint (free/trial → starter)
17. ✅ Downgrade endpoint (schedule downgrade for period end)
18. ✅ Cancel endpoint (downgrade to free at period end)
19. ✅ Trial expiration cron job (daily)
20. ✅ Trial reminder emails (7, 3, 1 day before expiration)

**Priority 5 (Week 9-10): Failed Payments & Grace Period**
21. ✅ Payment failure handling (status → `past_due`)
22. ✅ 7-day grace period logic
23. ✅ Dunning emails (immediate, day 3, day 7)
24. ✅ Auto-downgrade after grace period expires
25. ✅ Payment recovery endpoint

**Priority 6 (Week 11-12): Admin Tools & Monitoring**
26. ✅ Admin subscription list + filters
27. ✅ MRR/ARR metrics endpoint
28. ✅ Transaction audit log
29. ✅ Manual override endpoints (extend trial, apply credit)
30. ✅ Connect account monitoring

**Deferred to Post-MVP:**
- Proration calculations (upgrades/downgrades)
- Coupon/discount system
- Multi-currency support
- Annual billing option
- Usage-based limits and tracking
- Tenant webhooks
- Invoice PDF generation (use Stripe-hosted invoices for MVP)

---

## 📖 API Endpoint Summary

### Public Endpoints (No Auth Required)
```
GET  /subscription/plans              - List available subscription plans
POST /subscription/webhook            - Stripe webhook (signature verified)
POST /booking/checkout                - End-user appointment payment checkout
```

### Tenant Endpoints (Requires JwtAuthGuard)
```
GET  /subscription/current            - Get tenant's current subscription
GET  /subscription/features           - Get available features for tenant
POST /subscription/checkout           - Start subscription payment (trial → paid)
POST /subscription/upgrade            - Upgrade plan
POST /subscription/downgrade          - Schedule downgrade
POST /subscription/cancel             - Cancel subscription
POST /subscription/reactivate         - Reactivate canceled subscription
POST /subscription/undo-downgrade     - Cancel scheduled downgrade

GET  /subscription/payment-methods    - List payment methods
POST /subscription/payment-methods    - Add payment method
DELETE /subscription/payment-methods/:id  - Remove payment method
PATCH /subscription/payment-methods/:id/default  - Set default payment method

GET  /subscription/transactions       - List transaction history
GET  /subscription/transactions/:id   - Get transaction details
GET  /subscription/trial-status       - Get trial days remaining

GET  /tenant/stripe-connect/status    - Check Stripe Connect onboarding status
POST /tenant/stripe-connect/onboard   - Start Stripe Connect onboarding
POST /tenant/stripe-connect/refresh   - Refresh onboarding link
GET  /tenant/stripe-connect/dashboard - Get Stripe dashboard login link

GET  /tenant/payment-settings         - Get appointment payment settings
PATCH /tenant/payment-settings        - Update payment settings (price, toggle)

GET  /tenant/fiscal-info              - Get fiscal information (RFC, etc.)
POST /tenant/fiscal-info              - Add fiscal information
PATCH /tenant/fiscal-info             - Update fiscal information
```

### Admin Endpoints (Requires AdminGuard)
```
POST /subscription/plans              - Create new plan
PATCH /subscription/plans/:id         - Update plan (change pricing)

GET  /admin/subscriptions             - List all subscriptions (paginated)
GET  /admin/subscriptions/metrics     - Get MRR, ARR, churn, conversion metrics
POST /admin/subscriptions/:id/override - Manual subscription override

GET  /admin/transactions              - List all platform transactions
GET  /admin/revenue/summary           - Revenue breakdown

GET  /admin/stripe-connect/accounts   - List all Connect accounts
GET  /admin/stripe-connect/disputes   - List disputes/chargebacks
```

---

## 💡 Implementation Tips

### 1. Stripe Test Cards (Mexico)
```
Success: 4242 4242 4242 4242 (any future expiry, any CVC)
Decline: 4000 0000 0000 0002
Authentication Required: 4000 0027 6000 3184
Insufficient Funds: 4000 0000 0000 9995
```

### 2. Local Webhook Testing
```bash
# Install Stripe CLI
brew install stripe/stripe-cli/stripe

# Login to Stripe
stripe login

# Forward webhooks to local server
stripe listen --forward-to localhost:3000/subscription/webhook

# Trigger test events
stripe trigger invoice.paid
stripe trigger invoice.payment_failed
stripe trigger customer.subscription.deleted
```

### 3. Raw Body for Webhook Verification
Stripe signature verification requires the raw request body. Configure NestJS:

```typescript
// main.ts
app.use('/subscription/webhook', express.raw({ type: 'application/json' }));
app.useGlobalPipes(new ValidationPipe());  // After webhook route

// webhook.controller.ts
@Post('webhook')
async handleWebhook(@Req() req: RawBodyRequest<Request>) {
  const sig = req.headers['stripe-signature'];
  const event = stripe.webhooks.constructEvent(req.rawBody, sig, webhookSecret);
  // ...
}
```

### 4. Feature Gating Patterns
```typescript
// Method 1: Guard + Decorator (Controller level)
@Post('/booking/public')
@RequireFeature(Feature.PUBLIC_BOOKING_PAGE)
async createBooking() { ... }

// Method 2: Service level check (more flexible)
async createBooking(tenantId: string) {
  const hasAccess = await this.subscriptionService.hasFeature(
    tenantId,
    Feature.PUBLIC_BOOKING_PAGE
  );
  
  if (!hasAccess) {
    throw new ForbiddenException({
      message: 'This feature requires Starter plan',
      feature: 'public_booking_page',
      upgradeUrl: '/subscription/upgrade',
    });
  }
  
  // Continue with booking logic...
}

// Method 3: Frontend uses /subscription/features to hide UI elements
```

### 5. Handling Scheduled Downgrades
```typescript
// Cron job runs daily
@Cron('0 0 * * *')  // Midnight UTC
async processScheduledChanges() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const subscriptionsToUpdate = await this.subscriptionModel.find({
    scheduledChangeDate: { $lte: today },
    scheduledPlanId: { $exists: true },
  });
  
  for (const subscription of subscriptionsToUpdate) {
    // Apply the scheduled change
    subscription.planId = subscription.scheduledPlanId;
    subscription.status = subscription.scheduledPlanId === 'free' ? 'canceled' : 'active';
    
    // Clear scheduled change fields
    subscription.scheduledPlanId = null;
    subscription.scheduledChangeDate = null;
    
    await subscription.save();
    
    // Send notification
    await this.notificationService.sendPlanChangeEmail(subscription);
    
    // If downgrading to free, cancel Stripe subscription
    if (subscription.planId === 'free' && subscription.stripeSubscriptionId) {
      await this.stripe.subscriptions.cancel(subscription.stripeSubscriptionId);
    }
  }
}
```

### 6. Platform Fee Calculation (Stripe Connect)
```typescript
// When creating appointment checkout
const platformFeePercentage = 0.05;  // 5%
const appointmentPrice = 200;  // 200 MXN

const platformFeeAmount = Math.round(appointmentPrice * platformFeePercentage * 100);  // 1000 cents = 10 MXN

const session = await stripe.checkout.sessions.create({
  // ... other config
  payment_intent_data: {
    application_fee_amount: platformFeeAmount,  // Your platform keeps 10 MXN
    transfer_data: {
      destination: tenant.stripeConnectAccountId,  // Tenant receives 190 MXN
    },
  },
});

// Alternative: Use Stripe's built-in split
// Stripe takes their processing fee (~3.6% + 3 MXN in Mexico)
// You take your platform fee (5%)
// Tenant receives the rest
```

---

## 🔗 Useful Resources

### Stripe Documentation
- [Stripe Subscriptions Guide](https://stripe.com/docs/billing/subscriptions/overview)
- [Stripe Connect (Standard)](https://stripe.com/docs/connect/standard-accounts)
- [Stripe Webhooks](https://stripe.com/docs/webhooks)
- [Stripe Testing](https://stripe.com/docs/testing)
- [Stripe Mexico Guide](https://stripe.com/docs/payments/international)

### NestJS Integration
- [NestJS + Stripe](https://docs.nestjs.com/recipes/stripe)
- [NestJS Cron Jobs](https://docs.nestjs.com/techniques/task-scheduling)
- [NestJS Guards](https://docs.nestjs.com/guards)

### Mexican Tax Compliance
- [SAT - Facturación Electrónica](https://www.sat.gob.mx/aplicacion/operacion/31274/facturacion)
- [RESICO Tax Regime](https://www.sat.gob.mx/consulta/71895/conoce-el-nuevo-regimen-simplificado-de-confianza)

---

## ❓ Final Open Questions for Product Owner

1. **Platform Fee**: What percentage or flat fee should we charge on end-user appointment payments?
   - Recommendation: 5% of appointment price
   - Stripe takes ~3.6% + 3 MXN processing fee
   - Tenant receives the remainder

2. **Stripe Account Type**: Standard vs Express Connect?
   - **Standard**: Tenant creates full Stripe account (more control, more setup)
   - **Express**: Simplified onboarding (less control, faster setup)
   - Recommendation: **Standard** for B2B customers who want full control

3. **Free Tier Limitations**: Should we add usage limits to free tier later?
   - Examples: Max 100 appointments/month, max 500 end-users
   - For MVP: Unlimited (trust-based)
   - Later: Add soft limits with upgrade prompts

4. **Manual Invoice Generation**: Do you want to issue CFDI automatically, or keep it manual?
   - Current plan: Manual (you handle separately)
   - Future option: Integrate with PAC (Facturama, FacturAPI) for automation

5. **Annual Billing**: When should we add annual subscription option?
   - Not in MVP (monthly only)
   - Post-MVP: Add 20% discount for annual (like 950 MXN/year vs 1188 MXN/year if monthly)

---

**Document Status:** ✅ Complete and Ready for Implementation  
**Created:** December 27, 2025  
**Last Updated:** December 27, 2025  
**Version:** 2.0 (Business model finalized)

### Subscription States & Transitions
```
[New Tenant]
    ├─→ [Trial] (14 days free)
    │     ├─→ [Active] (payment successful)
    │     └─→ [Expired] (trial ended, no payment)
    │
    ├─→ [Active] (immediate paid subscription)
          ├─→ [Past Due] (payment failed)
          │     ├─→ [Active] (payment recovered)
          │     └─→ [Canceled] (grace period expired)
          │
          └─→ [Canceled] (user canceled)
                └─→ [Active] (reactivated)
```

### Feature Gating Example
```typescript
// In appointment controller
@Post()
@UseGuards(JwtAuthGuard, FeatureAccessGuard)
@RequireFeature(Feature.BASIC_SCHEDULING)
async createAppointment(@Request() req, @Body() dto: CreateAppointmentDto) {
  const usage = await this.usageTracker.getUsage(req.session.tenant);
  const limits = await this.subscriptionService.getFeatureLimits(req.session.tenant);
  
  if (usage.appointments >= limits.maxAppointments) {
    throw new ForbiddenException('Appointment limit reached. Please upgrade your plan.');
  }
  
  // Create appointment...
}
```

### Webhook Signature Verification (Stripe)
```typescript
@Post('webhook')
async handleWebhook(@Req() req: RawBodyRequest<Request>) {
  const sig = req.headers['stripe-signature'];
  
  try {
    const event = stripe.webhooks.constructEvent(
      req.rawBody,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
    
    // Handle event...
  } catch (err) {
    throw new BadRequestException('Invalid signature');
  }
}
```

---

## 📝 Migration Plan

### Step 1: Existing Tenants
- [ ] Create migration script for existing tenants
- [ ] Decide: Give existing tenants free tier or trial?
- [ ] Communicate changes to existing customers
- [ ] Set grace period for existing tenants to add payment

### Step 2: Backward Compatibility
- [ ] Ensure all existing features work during migration
- [ ] Feature flags default to "allowed" during transition
- [ ] Gradual rollout of subscription enforcement

---

## 🧪 Testing Requirements

- [ ] Unit tests for subscription service methods
- [ ] Unit tests for proration calculations
- [ ] Unit tests for feature access validation
- [ ] Integration tests for Stripe webhook handling
- [ ] E2E tests for subscription lifecycle
  - [ ] Trial signup → Paid conversion
  - [ ] Upgrade flow
  - [ ] Downgrade flow
  - [ ] Cancellation flow
  - [ ] Payment failure → Recovery
- [ ] Load testing for webhook endpoints
- [ ] Test multi-tenant isolation (tenant A can't access tenant B's subscription)

---

## 🔒 Security Considerations

- [ ] Validate webhook signatures (Stripe, PayPal, etc.)
- [ ] Encrypt payment method details at rest
- [ ] Never log full card numbers or CVV
- [ ] Rate limit subscription change endpoints
- [ ] Prevent subscription manipulation by unauthorized users
- [ ] Audit log all subscription changes
- [ ] PCI DSS compliance considerations (use Stripe Elements, don't touch raw card data)

---

## 📚 Documentation Needs

- [ ] API documentation for all subscription endpoints (Swagger)
- [ ] Frontend integration guide
- [ ] Webhook integration guide for tenant webhooks
- [ ] Admin dashboard user guide
- [ ] Subscription lifecycle flowcharts
- [ ] Pricing & feature comparison table
- [ ] FAQ for common subscription questions

---

## 🚀 Deployment Considerations

- [ ] Environment variables for Stripe keys (test/production)
- [ ] Webhook endpoint registration in Stripe dashboard
- [ ] Monitoring for webhook failures
- [ ] Alerts for failed payments
- [ ] Backup payment recovery process (manual intervention)
- [ ] Database indexes for subscription queries
  - [ ] Index on `tenant` field in Subscription
  - [ ] Index on `status` field in Subscription
  - [ ] Index on `planId` field in Subscription
  - [ ] Compound index on `tenant + status`

---

## 📊 Metrics to Track

### Business Metrics
- [ ] Monthly Recurring Revenue (MRR)
- [ ] Annual Recurring Revenue (ARR)
- [ ] Customer Lifetime Value (CLV)
- [ ] Churn Rate (monthly/annual)
- [ ] Trial Conversion Rate
- [ ] Upgrade/Downgrade Ratio
- [ ] Average Revenue Per User (ARPU)

### Technical Metrics
- [ ] Webhook processing success rate
- [ ] Payment success rate
- [ ] Failed payment recovery rate
- [ ] API response times for subscription endpoints
- [ ] Feature gate evaluation performance

---

## 🎯 Success Criteria

- [ ] 99.9% webhook processing success rate
- [ ] <2 second response time for subscription status checks
- [ ] Zero unauthorized feature access
- [ ] Automated trial expiration with 100% accuracy
- [ ] Payment retry recovery rate >30%
- [ ] Zero data leaks between tenants

---

## 📅 Recommended Rollout Phases

**Phase 1 (Week 1-2):** Core infrastructure, plans, subscription entity  
**Phase 2 (Week 3-4):** Stripe integration, checkout, webhooks  
**Phase 3 (Week 5):** Self-service management APIs  
**Phase 4 (Week 6):** Feature gating and usage limits  
**Phase 5 (Week 7):** Trial management and conversion  
**Phase 6 (Week 8-9):** Admin tools and monitoring  
**Phase 7 (Week 10+):** Advanced features as needed  

---

## ❓ Open Questions for Product Owner

1. **Target Market Geography**: Do we need to comply with specific regional regulations? (GDPR, CCPA, etc.)
2. **Tax Handling**: Should we use Stripe Tax or manual tax calculation?
3. **Refund Policy**: What's our refund policy? (30-day money back, prorated, no refunds?)
4. **Grandfathering**: Should existing tenants be grandfathered into current pricing forever?
5. **Free Tier Strategy**: Should we offer a permanently free tier or trial-only?
6. **Annual Commitment**: Do we want to push annual plans? What incentives?
7. **Enterprise Sales**: Will enterprise customers require custom contracts and manual sales?
8. **Billing Support**: Do we need a customer support portal for billing inquiries?

---

**Document Version:** 1.0  
**Created:** December 27, 2025  
**Next Review:** After business model questions are answered




---

✅ Your Business Model Summary:
Pricing Structure:
Free Tier: Client management only (CRUD operations on end-users)
30-Day Trial: Full access to Starter tier features
Starter Tier: 99 MXN/month
Public booking website with scheduler UI
Optional payment requirement for appointments (tenant can toggle)
Automated reminders for end-users
Key Features:
Free: Manual appointment management + Google Calendar sync
Paid (Starter): Public booking page + optional end-user payments + automated reminders
Billing:
Flat fee per tenant (99 MXN/month)
Plus end-user pay-per-appointment (if tenant enables it)
Auto-renewal monthly
7-day grace period on payment failure
Downgrade to free tier when subscription expires
Upgrade: Immediate
Downgrade: At cycle end
Payment Gateway:
Stripe only (MXN currency)
Invoice-based billing supported
🇲🇽 Mexican Fiscal & Tax Regulation Questions
Based on Mexican tax regulations (SAT - Servicio de Administración Tributaria), I need to understand:

1. CFDI (Comprobante Fiscal Digital por Internet) Requirements
Mexico requires electronic invoices (CFDI) for B2B transactions. Questions:

Q1: Should we automatically generate CFDI invoices for each monthly subscription payment?
Q2: Do you have a SAT authorization and digital signature (CSD - Certificado de Sello Digital) for issuing CFDIs?
Q3: Should we integrate with a PAC (Proveedor Autorizado de Certificación) like Facturama, FacturAPI, or Finkok for CFDI stamping?
Q4: What's your company's RFC (Registro Federal de Contribuyentes)?
Q5: Should tenants provide their RFC during registration to receive proper invoices?
2. IVA (Value Added Tax)
Current IVA rate in Mexico is 16%.

Q6: Should the 99 MXN price be before IVA (99 MXN + 16% IVA = 115.84 MXN total)?
OR is 99 MXN the final price including IVA (85.34 MXN + 13.66 MXN IVA)?
Q7: For end-user appointment payments, should we also charge 16% IVA?
Q8: Are you registered as a tax-compliant business (Persona Física con Actividad Empresarial or Persona Moral)?
3. Payment Method & End-User Payments
For the end-user pay-to-schedule feature:

Q9: What should be the pricing model for end-users?
Fixed fee per appointment (e.g., 200 MXN)?
Tenant sets their own price?
Percentage-based (tenant keeps 90%, you keep 10%)?
Q10: Should end-users also receive CFDI invoices for their appointment payments?
Q11: If a tenant collects payment from end-users, legally who is selling the service?
Is it your platform (you issue CFDI to end-user)?
Or is it the tenant's business (they issue CFDI to end-user)?
4. Invoice Details & Format
Q12: What information should be on the CFDI invoice?
Service description: "Servicio de plataforma de agendamiento de citas" or similar?
CFDI Use (Uso CFDI): G03 (Gastos en general) or P01 (Por definir)?
Payment Method (Método de pago): PUE (Pago en una sola exhibición)?
Payment Form (Forma de pago): 28 (Tarjeta de crédito), 04 (Tarjeta de débito)?
5. Retention & Reporting
Q13: Do you need to issue invoices with ISR retention (retención de ISR) for certain customers?
Q14: Should we store invoice data for SAT reporting purposes (6+ years legally required)?
6. Stripe Integration with Mexican Regulations
Q15: Are you aware that Stripe charges happen in USD but can be displayed in MXN? Is this acceptable?
Q16: Should we use Stripe's automatic tax calculation, or handle IVA manually?
Q17: For invoice-based billing, should we send the CFDI via email separately from Stripe receipts?
🎯 Technical Implications Based on Your Answers
Based on what you've told me, here's what I'm planning to prioritize:

Immediate Priority (Week 1-2):
✅ Three-tier system: Free, Trial (30 days), Starter (99 MXN)
✅ Feature gating middleware
Free: User CRUD + Manual appointments + Google Calendar sync
Starter: Public booking page + Payment toggle + Automated reminders
✅ Stripe integration for subscription (monthly recurring)
✅ Dual payment system: Tenant subscriptions + End-user appointment payments
Follow-up Priority (Week 3-4):
🇲🇽 CFDI invoice generation (pending your answers)
🇲🇽 IVA calculation and handling
🇲🇽 PAC integration for invoice stamping
✅ Downgrade logic (wait until cycle end)
✅ Upgrade logic (immediate)
✅ 7-day grace period for failed payments
Important Clarifications Needed:
End-user payment pricing model - How much should end-users pay per appointment? Who sets the price?
IVA handling - Is 99 MXN before or after tax?
CFDI requirements - Do you have PAC integration ready or should I recommend one?
RFC collection - Should we require tenant RFC during registration?

Q1 - no, i dont want to integrate an API for CFDI invoicing yet
Q2 - yes, but i dont see how that is relevant
Q3 - no
Q4 - what do you care?
Q5 - there should be a fiscal information section in the UI so that business can input that information if desired
Q6 - 99 with IVA included
Q7 - 16% should be included in final price set by the tenant, this must be specified in terms and conditions
Q8 - as RESICO
Q9 - fixed free per appointment, and the fee must be configured by the tenant in their UI
Q10 - not as an automation, that must be created by the tenant independently
Q11 - the tenant business is selling the service, we are just scheduling
Q12 - this is all yet to be determined, meanwhile, setup whatever dummy values you see fit
Q13- i dont know
Q14 - yes
Q15 - i dont know, but I've paid in pesos before
Q16 - i dont know
Q17 - i would to that separately on my own, no need to automate