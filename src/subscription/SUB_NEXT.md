# Subscription Implementation - Incremental Development Plan

## 🎯 Recommended Development Order

### **Phase 1: Core Foundation (Week 1)**
**Why first?** Everything else depends on these entities and their relationships.

#### 1. Database Schema First (1.1 + 1.2)
- [ ] Create `SubscriptionPlan` schema (free/trial/starter)
- [ ] Create `Subscription` schema 
- [ ] Create `FiscalInfo` schema
- [ ] Seed initial plans in database
- [ ] Add database indexes

**Reasoning**: Other phases need these entities to exist

#### 2. Link to Tenants (1.3)
- [ ] Add `subscriptionId` reference to Tenant entity
- [ ] Add `stripeCustomerId` to Tenant entity
- [ ] Add `stripeConnectAccountId` to Tenant entity
- [ ] Update tenant registration to create trial subscription
- [ ] Ensure tenant sessions validate subscription status

**Reasoning**: Establishes the core relationship

---

### **Phase 2: Basic Stripe Setup (Week 1-2)**
**Why next?** Payment infrastructure must exist before features can check subscription status.

#### 3. Stripe SDK & Customer Management (2.1 + 2.2 basics)
- [ ] Install Stripe: `npm install stripe @stripe/stripe-js`
- [ ] Configure Stripe API keys in environment variables
  - [ ] `STRIPE_SECRET_KEY`
  - [ ] `STRIPE_PUBLISHABLE_KEY`
  - [ ] `STRIPE_WEBHOOK_SECRET`
- [ ] Create StripeService injectable
- [ ] Create Stripe customers on tenant registration
- [ ] Link Stripe customer ID to tenant record

**Skip for now**: Checkout endpoints, payment methods endpoints

**Reasoning**: Just get the foundation working

---

### **Phase 3: Feature Gating (Week 2)**
**Why now?** This is what makes subscriptions actually matter - protecting features.

#### 4. Feature Access Control (4.1 + 4.2)
- [ ] Create `Feature` enum with all features:
  - `CLIENT_MANAGEMENT`
  - `MANUAL_APPOINTMENTS`
  - `GOOGLE_CALENDAR_SYNC`
  - `PUBLIC_BOOKING_PAGE`
  - `END_USER_SELF_SCHEDULING`
  - `AUTOMATED_REMINDERS`
  - `END_USER_PAYMENTS`
- [ ] Create `FeatureAccessGuard` (NestJS guard)
- [ ] Create `@RequireFeature()` decorator
- [ ] Create `SubscriptionService.hasFeature(tenantId, feature)` method
- [ ] Create `GET /subscription/features` endpoint
- [ ] Apply `@RequireFeature()` to existing endpoints:
  - Public booking page endpoints
  - Self-scheduling endpoints
  - Automated reminder endpoints

**Reasoning**: Now you can **test** subscriptions blocking/allowing features

---

### **Phase 4: Self-Service Subscription Management (Week 2-3)**
**Why now?** Tenants need to upgrade/downgrade/cancel.

#### 5. Tenant Dashboard APIs (3.1)
- [ ] Create `GET /subscription/current` endpoint
  - Return current subscription details
  - Include next billing date
  - Show payment method info
  - Show scheduled changes
- [ ] Create `POST /subscription/upgrade` endpoint
  - Upgrade from free/trial to starter (99 MXN)
  - **Effect**: Immediate (no prorating for MVP)
  - Redirect to Stripe Checkout
- [ ] Create `POST /subscription/downgrade` endpoint
  - Downgrade from starter to free
  - **Effect**: Scheduled for end of current billing cycle
  - Display warning with scheduled date
- [ ] Create `POST /subscription/cancel` endpoint
  - Cancel subscription (downgrade to free at period end)
  - Optional `immediate` flag
  - Send cancellation confirmation email
- [ ] Create `POST /subscription/reactivate` endpoint
  - Reactivate canceled subscription before period ends
- [ ] Create `POST /subscription/undo-downgrade` endpoint
  - Cancel scheduled downgrade

**Reasoning**: Core user-facing functionality

#### 6. Stripe Checkout Integration (2.2 continued)
- [ ] Create `POST /subscription/checkout` endpoint
  - Create Stripe Checkout Session for subscription
  - Mode: `subscription`
  - Price: 99 MXN/month (create Stripe Price object)
  - Trial period: 30 days
  - Success/cancel URLs for frontend redirect
  - Return checkout session URL
- [ ] Create `GET /subscription/payment-methods` endpoint
  - List tenant's saved payment methods from Stripe
- [ ] Create `POST /subscription/payment-methods` endpoint
  - Add new payment method via Stripe SetupIntent
- [ ] Create `DELETE /subscription/payment-methods/:id` endpoint
  - Detach payment method from Stripe customer
- [ ] Create `PATCH /subscription/payment-methods/:id/default` endpoint
  - Set default payment method for subscription

**Reasoning**: Complete the upgrade flow

---

### **Phase 5: Webhooks & Automation (Week 3-4)**
**Why now?** Automate subscription lifecycle.

#### 7. Stripe Webhooks (2.5)
- [ ] Create `POST /subscription/webhook` endpoint (public, Stripe calls this)
- [ ] Verify webhook signature using `STRIPE_WEBHOOK_SECRET`
- [ ] Handle subscription payment events:
  - [ ] `checkout.session.completed` - Trial converted to paid
  - [ ] `invoice.paid` - Monthly subscription payment successful
  - [ ] `invoice.payment_failed` - Payment failed, mark subscription as `past_due`
  - [ ] `customer.subscription.updated` - Subscription status changed
  - [ ] `customer.subscription.deleted` - Subscription canceled in Stripe
- [ ] Create webhook event logging for debugging
  - Store all webhook events in `StripeWebhookLog` collection
- [ ] Implement idempotency for webhook handling
  - Check if event was already processed using event ID
  - Prevent duplicate processing

**Reasoning**: Stripe tells you when payments succeed/fail

#### 8. Trial Automation (5.1 + 5.2)
- [ ] Verify trial creation on tenant registration (already in Phase 1)
- [ ] Create trial reminder email templates:
  - **Day 23** (7 days remaining): "Your trial ends in 7 days"
  - **Day 27** (3 days remaining): "Only 3 days left in your trial"
  - **Day 29** (1 day remaining): "Last day of your trial!"
  - **Day 30** (expired): "Your trial has ended"
- [ ] Create `GET /subscription/trial-status` endpoint
  - Return days remaining in trial
  - Return if trial is expiring soon (< 7 days)
- [ ] Create cron job: `@Cron('0 0 * * *')` (runs daily at midnight)
  - Query all subscriptions where `status = 'trial'` and `trialEndDate <= today`
  - For each expired trial:
    - Check if tenant added payment method
    - If YES: Convert to `active` subscription (Stripe handles this)
    - If NO: Downgrade to `free` plan
    - Send trial expiration email
    - Log trial conversion metrics
- [ ] Create `POST /subscription/convert-trial` endpoint (manual conversion)

**Reasoning**: Trials need to auto-expire

---

### **Phase 6: Stripe Connect (Week 4-5)**
**Why later?** More complex, separate from core subscription features.

#### 9. Connect Account Setup (2.3)
- [ ] Set up Stripe Connect account type: **Standard Connect**
- [ ] Create `POST /tenant/stripe-connect/onboard` endpoint
  - Create Stripe Connect account for tenant
  - Generate onboarding link (Stripe hosted onboarding)
  - Return onboarding URL for frontend redirect
  - Store `stripeConnectAccountId` in tenant record
- [ ] Create `GET /tenant/stripe-connect/status` endpoint
  - Check if tenant has completed Stripe Connect onboarding
  - Return: `not_started`, `pending`, `complete`
  - Check if `charges_enabled` and `payouts_enabled`
- [ ] Create `POST /tenant/stripe-connect/refresh` endpoint
  - Generate new onboarding link if tenant didn't complete
- [ ] Create `GET /tenant/stripe-connect/dashboard` endpoint
  - Generate Stripe Connect dashboard login link for tenant
  - Allows tenant to view earnings, payouts, disputes
- [ ] Add `requiresPayment` toggle to Tenant settings schema
  - Boolean flag: tenant can enable/disable payment requirement
  - Only available if Stripe Connect is set up
- [ ] Add `appointmentPrice` to Tenant settings schema
  - Fixed price in MXN (tenant configures)
  - Price must include 16% IVA (stated in T&C)
- [ ] Create `GET /tenant/payment-settings` endpoint
- [ ] Create `PATCH /tenant/payment-settings` endpoint
  - Update `requiresPayment` toggle
  - Update `appointmentPrice`
  - Validation: Can only enable if Stripe Connect is set up
  - Validation: Must have Starter plan or trial

**Reasoning**: Tenants need to receive payments

#### 10. Appointment Payments (2.4)
- [ ] Create `POST /booking/checkout` endpoint (public, for end-users)
  - Requires: tenantId, appointmentDetails
  - Check if tenant has `requiresPayment` enabled
  - If yes, create Stripe Checkout Session:
    - Mode: `payment` (one-time payment)
    - Amount: tenant's `appointmentPrice` in MXN
    - Destination: tenant's `stripeConnectAccountId`
    - Application fee: TBD (e.g., 5% platform fee)
    - Metadata: appointmentId, tenantId, endUserId
  - Return checkout session URL
  - Appointment status: `pending_payment`
- [ ] Handle Connect payment webhooks:
  - [ ] `checkout.session.completed` - End-user paid for appointment
  - [ ] `charge.succeeded` - Charge to connected account succeeded
  - [ ] `charge.failed` - Charge failed
- [ ] Update appointment status on payment success
  - `pending_payment` → `confirmed`
- [ ] Handle Connect onboarding webhooks:
  - [ ] `account.updated` - Connect account onboarding status changed

**Reasoning**: Complete the dual payment system

---

### **Phase 7: Polish & Monitoring (Week 5-6)**

#### 11. Billing History (3.2)
- [ ] Create `Transaction` entity/schema (for audit trail)
  - Tenant reference
  - Type: `subscription_payment`, `appointment_payment`, `refund`, `platform_fee`
  - Amount, currency (MXN)
  - Stripe charge ID or invoice ID
  - Status: `pending`, `succeeded`, `failed`, `refunded`
  - Description
  - Metadata: JSON object
  - Created timestamp
- [ ] Create `GET /subscription/transactions` endpoint
  - List all tenant's subscription transactions
  - Pagination and filtering (date range, type, status)
- [ ] Create `GET /subscription/transactions/:id` endpoint
  - Get details of specific transaction
  - Include Stripe receipt URL
- [ ] Implement 6+ year retention policy (Mexican tax compliance)

**Reasoning**: Audit trail and compliance

#### 12. Failed Payment Recovery (6.1 - 6.4)
- [ ] Handle `invoice.payment_failed` webhook
  - Update subscription status to `past_due`
  - Set grace period end date = failure date + 7 days
  - Keep paid features ENABLED during grace period
  - Send immediate payment failure email to tenant admin
- [ ] Send payment retry reminder emails:
  - **Day 3**: "Payment retry in progress"
  - **Day 5**: "2 days remaining to update payment"
  - **Day 7**: "Final day - Subscription will be canceled"
- [ ] Create cron job to check `past_due` subscriptions daily
  - If grace period expired (7 days passed):
    - Downgrade to `free` plan
    - Revoke access to paid features
    - Set `status = 'canceled'`
    - Send subscription suspended email
- [ ] Create `POST /subscription/retry-payment` endpoint
  - Manually trigger Stripe payment retry
  - Tenant can click "Retry Payment" in dashboard
- [ ] Handle `invoice.paid` after recovery
  - Update subscription status back to `active`
  - Reset grace period
  - Send payment successful email

**Reasoning**: Handle edge cases

#### 13. Admin Dashboard (7.1 - 7.2)
- [ ] Create admin-only endpoints (protected by AdminGuard)
- [ ] Create `GET /admin/subscriptions` endpoint
  - List all subscriptions across all tenants
  - Filters: plan, status, date range
  - Pagination, sorting
  - Search by tenant name/email
- [ ] Create `GET /admin/subscriptions/metrics` endpoint
  - **MRR** (Monthly Recurring Revenue)
  - **ARR** (Annual Recurring Revenue)
  - **Churn rate**
  - Active subscriptions by plan
  - Trial conversion rate
  - Total revenue this month
- [ ] Create `POST /admin/subscriptions/:id/override` endpoint
  - Manually extend trial
  - Manually activate/suspend subscription
  - Apply credits or discounts
  - Grant temporary feature access
  - Audit log all manual changes
- [ ] Create `GET /admin/transactions` endpoint
  - All transactions across all tenants
  - Filter by type, status, date range
  - Export to CSV for accounting
- [ ] Create `GET /admin/revenue/summary` endpoint
  - Total platform revenue (subscription fees)
  - Total appointment payment volume
  - Platform fees earned from Connect transactions
  - Revenue by month/quarter/year
- [ ] Create `GET /admin/stripe-connect/accounts` endpoint
  - List all tenant Stripe Connect accounts
  - Status: pending, active, restricted, disabled
- [ ] Create `GET /admin/stripe-connect/disputes` endpoint
  - List all disputes/chargebacks
  - Notify affected tenants

**Reasoning**: Business visibility

---

## ⚡ Critical Path Summary

```
Week 1: Database → Stripe Basic → Feature Gating
Week 2: Subscription Management → Checkout
Week 3: Webhooks → Trial Automation  
Week 4: Stripe Connect
Week 5: Polish & Admin Tools
```

---

## 🎯 MVP-Critical vs Can-Wait

### **Must Have for Launch:**
- ✅ Phase 1: Core Foundation (Database schemas)
- ✅ Phase 2: Basic Stripe Setup
- ✅ Phase 3: Feature Gating
- ✅ Phase 4: Self-Service Subscription Management
- ✅ Phase 5: Webhooks & Automation
- ✅ Phase 6: Stripe Connect (Basic - items 9-10)

### **Can Add Later:**
- ⏳ Phase 7: Polish & Monitoring (nice to have)
- ⏳ Advanced features (Phase 7.3+ in SUB_TODO.md): Multi-currency, coupons, enterprise
- ⏳ Detailed admin metrics
- ⏳ Proration (explicitly excluded from MVP)

---

## 🚀 Key Decision Point

**Should you implement Stripe Connect before or after launching basic subscriptions?**

**Recommendation:** Implement Stripe Connect **after** basic subscriptions.

**Reasoning:**
- Launch with just tenant subscriptions first (Phases 1-5)
- Validate core subscription business model
- Then add appointment payments as Phase 2 of rollout (Phase 6)
- This allows faster time to market for core value proposition

**Alternative:** If appointment payments are critical to your business model from day 1, include Phase 6 in MVP.

---

## 📋 Current Status

- [ ] **Phase 1**: Not started
- [ ] **Phase 2**: Not started
- [ ] **Phase 3**: Not started
- [ ] **Phase 4**: Not started
- [ ] **Phase 5**: Not started
- [ ] **Phase 6**: Not started
- [ ] **Phase 7**: Not started

---

## 🎯 Next Action

**Start with Phase 1, Step 1**: Create database schemas
- Create `SubscriptionPlan` entity
- Create `Subscription` entity
- Create `FiscalInfo` entity

Ready to begin? Let me know when you want to start coding Phase 1!
