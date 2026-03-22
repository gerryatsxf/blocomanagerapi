# Google Cloud Platform OAuth Setup

## Overview

This project uses **two Google OAuth 2.0 clients** within the same GCP project. Both share the same consent screen and scope configuration at the project level, but serve different purposes with separate redirect URIs. This follows Google's **incremental authorization** pattern: users logging in only see minimal permissions, while broader scopes (calendar, email) are requested later as a separate, intentional action.

## OAuth Clients

### BlocoManagerGoogleAuth (`m5vu...`)

- **Purpose**: Admin/tenant panel login (lightweight, no scary permissions)
- **Used by**: `google-auth.service.ts`, `google-calendar.provider.ts`
- **Env vars**: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI`
- **Redirect URI**: `{BASE_URL}/auth/google/callback`
- **Scopes requested**: `userinfo.email`, `userinfo.profile`

### BlocoManagerGmailAPI (`v82i...`)

- **Purpose**: Calendar events and email sending on behalf of tenants
- **Used by**: `google-oauth.service.ts`, `google-calendar.service.ts`, `video-call.service.ts`, `notification.service.ts`
- **Env vars**: `GOOGLE_EMAIL_CLIENT_ID`, `GOOGLE_EMAIL_CLIENT_SECRET`, `GOOGLE_EMAIL_REDIRECT_URI`
- **Redirect URI**: `{BASE_URL}/api/admin/auth/google/callback`
- **Scopes requested**: `calendar`, `userinfo.email`, `gmail.send`

### Why Two Clients?

A user exploring the platform logs in via `m5vu...` and only consents to sharing their name and email. The broader calendar/gmail consent screen only appears when a tenant admin explicitly clicks "Connect Google Account" in Settings (via `v82i...`). This keeps onboarding frictionless.

## Consent Screen Scopes (Project-Level)

Configured once, shared by both clients. Each client only requests the subset it needs.

| Scope | Type | Purpose |
|-------|------|---------|
| `userinfo.email` | Non-sensitive | User email for login |
| `userinfo.profile` | Non-sensitive | User name for login |
| `calendar` | Sensitive | Tenant calendar events |
| `gmail.send` | Restricted | Send emails for tenants |

## Redirect URIs

Configured per client independently. Add ngrok URIs to each client when testing remotely.

## Re-Authorization

After adding scopes, tenant admins must re-authorize in Settings to get tokens with updated permissions.

## Environment Files

- `env/dev.env` — localhost redirect URIs
- `env/ngrokdev.env` — ngrok redirect URIs
- Start with: `npm run start:ngrokdev`
