/**
 * Platform Constants
 *
 * The platform is NOT a tenant. It is the engine that spawns and manages
 * tenant instances. PLATFORM_ID is used for:
 * - System-level Gmail OAuth credentials (sending platform emails)
 * - Global/shared products visible to all tenants
 * - Default fallback when no tenant context can be resolved
 * - Platform owner/manager user sessions
 *
 * Tenants are parameterized instances running on infrastructure the platform controls.
 * Platform roles (owner/manager) are a separate authority axis from tenant roles.
 */

/** Unique identifier for the platform — never a tenant ID */
export const PLATFORM_ID = 'blocomanager';

/** Check if a given ID is the platform (not a tenant) */
export function isPlatformId(id: string): boolean {
  return id === PLATFORM_ID;
}

/** Platform roles that operate above the tenant layer */
export type PlatformRole = 'platformOwner' | 'platformManager';

/** Check if a role is a platform-level role (owner or manager) */
export function isPlatformRole(role: string): boolean {
  return role === 'platformOwner' || role === 'platformManager';
}
