/**
 * Platform Configuration
 * 
 * The platform (BlocoManager) is the engine that spawns and manages tenants.
 * It is NOT a tenant itself. This file defines platform-specific domains
 * and configuration so they can be identified separately from tenant domains.
 */

import { PLATFORM_ID } from '../../common/platform.constants';

/**
 * Domains that belong to the platform, NOT to any tenant.
 * Requests from these domains are platform-level operations.
 */
export const PLATFORM_DOMAINS: string[] = [
  'blocomanager.com',
  'admin.blocomanager.com',
  'api.blocomanager.com',
];

/**
 * Platform configuration — analogous to TenantConfig but for the platform itself.
 */
export const PLATFORM_CONFIG = {
  id: PLATFORM_ID,
  name: 'BlocoManager',
  domain: 'blocomanager.com',
  adminDomain: 'admin.blocomanager.com',
  apiDomain: 'api.blocomanager.com',
  description: 'Platform that manages all tenant instances',
};

/**
 * Check if a domain belongs to the platform (not to a tenant).
 */
export function isPlatformDomain(domain: string): boolean {
  // Remove port number if present (e.g., localhost:3002 -> localhost)
  const cleanDomain = domain.split(':')[0];
  return PLATFORM_DOMAINS.includes(cleanDomain);
}
