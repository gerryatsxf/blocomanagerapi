/**
 * Tenant Configuration
 * Maps tenant IDs to their associated configuration including admin emails
 */

export interface TenantConfig {
  tenantId: string;
  name: string;
  adminEmail: string;
  domain: string;
  isActive: boolean;
}

export const TENANT_CONFIG_MAP: Record<string, TenantConfig> = {
  blocomanager: {
    tenantId: 'blocomanager',
    name: 'BlocoManager',
    adminEmail: 'blocomanager@gmail.com',
    domain: 'api.blocomanager.com',
    isActive: true,
  },
  aprendecoding: {
    tenantId: 'aprendecoding',
    name: 'AprendeCoding',
    adminEmail: 'aprendecoding.asesorias@gmail.com',
    domain: 'api.aprendecoding.com',
    isActive: true,
  },
  pedrorivero: {
    tenantId: 'pedrorivero',
    name: 'Pedro Rivero',
    adminEmail: 'pedrorivero@gmail.com',
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
 * Validate if an email is authorized for a tenant
 */
export function isEmailAuthorizedForTenant(tenantId: string, email: string): boolean {
  const tenantConfig = getTenantConfig(tenantId);
  if (!tenantConfig) return false;
  
  return tenantConfig.adminEmail.toLowerCase() === email.toLowerCase();
}

/**
 * Get all active tenants
 */
export function getActiveTenants(): TenantConfig[] {
  return Object.values(TENANT_CONFIG_MAP).filter(tenant => tenant.isActive);
}