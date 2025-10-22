/**
 * Tenant Configuration
 * Maps tenant IDs to their configuration including authorized provider emails
 */

export interface TenantConfig {
  tenantId: string;
  name: string;
  adminEmail: string; // Admin email for the tenant
  authorizedProviders: string[]; // List of provider emails that can authenticate for this tenant
  domain: string;
  isActive: boolean;
}

export const TENANT_CONFIG_MAP: Record<string, TenantConfig> = {
  blocomanager: {
    tenantId: 'blocomanager',
    name: 'BlocoManager',
    adminEmail: 'blocomanager@gmail.com',
    authorizedProviders: [
      'blocomanager@gmail.com',
      'pedrorivero@gmail.com',
      // Add more provider emails as needed
    ],
    domain: 'api.blocomanager.com',
    isActive: true,
  },
  aprendecoding: {
    tenantId: 'aprendecoding',
    name: 'AprendeCoding',
    adminEmail: 'aprendecoding.asesorias@gmail.com',
    authorizedProviders: [
      'aprendecoding.asesorias@gmail.com',
    ],
    domain: 'api.aprendecoding.com',
    isActive: true,
  },
  pedrorivero: {
    tenantId: 'pedrorivero',
    name: 'Pedro Rivero',
    adminEmail: 'pedrorivero@gmail.com',
    authorizedProviders: [
      'pedrorivero@gmail.com',
    ],
    domain: 'api.pedrorivero.com',
    isActive: true,
  },
};

/**
 * Get tenant configuration by tenant ID
 */
export function getTenantConfig(tenantId: string): TenantConfig | null {
  return TENANT_CONFIG_MAP[tenantId] || null;
}

/**
 * Get tenant ID by admin email
 */
export function getTenantByEmail(email: string): TenantConfig | null {
  return Object.values(TENANT_CONFIG_MAP).find(
    tenant => tenant.adminEmail.toLowerCase() === email.toLowerCase()
  ) || null;
}

/**
 * Validate if an email is authorized for a tenant (admin or provider)
 */
export function isEmailAuthorizedForTenant(tenantId: string, email: string): boolean {
  const tenantConfig = getTenantConfig(tenantId);
  if (!tenantConfig) return false;
  
  // Check if email is in the authorized providers list
  return tenantConfig.authorizedProviders.some(
    authorizedEmail => authorizedEmail.toLowerCase() === email.toLowerCase()
  );
}

/**
 * Check if an email is a provider (not the admin) for a tenant
 */
export function isProviderEmail(tenantId: string, email: string): boolean {
  const tenantConfig = getTenantConfig(tenantId);
  if (!tenantConfig) return false;
  
  return tenantConfig.adminEmail.toLowerCase() !== email.toLowerCase() &&
         isEmailAuthorizedForTenant(tenantId, email);
}

/**
 * Get all authorized providers for a tenant
 */
export function getAuthorizedProviders(tenantId: string): string[] {
  const tenantConfig = getTenantConfig(tenantId);
  return tenantConfig?.authorizedProviders || [];
}

/**
 * Get all active tenants
 */
export function getActiveTenants(): TenantConfig[] {
  return Object.values(TENANT_CONFIG_MAP).filter(tenant => tenant.isActive);
}