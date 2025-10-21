import { TenantConfig } from '../interfaces/tenant-config.interface';

export const TENANT_DOMAIN_MAPPING: Record<string, string> = {
  'aprendecoding.com': 'aprendecoding',
  'pedrorivero.com': 'pedrorivero',
  'blocomanager.com': 'blocomanager', // Default tenant
  'localhost': 'development', // For local development
};

export const TENANT_CONFIGS: Record<string, TenantConfig> = {
  aprendecoding: {
    tenantId: 'aprendecoding',
    domain: 'aprendecoding.com',
    name: 'Aprende Coding',
    description: 'Coding education platform',
  },
  pedrorivero: {
    tenantId: 'pedrorivero',
    domain: 'pedrorivero.com',
    name: 'Pedro Rivero',
    description: 'Personal consulting services',
  },
  blocomanager: {
    tenantId: 'blocomanager',
    domain: 'blocomanager.com',
    name: 'BlocoManager',
    description: 'Default tenant for BlocoManager services',
  },
  development: {
    tenantId: 'development',
    domain: 'localhost',
    name: 'Development Environment',
    description: 'Local development tenant',
  },
};

/**
 * Extract tenant ID from domain
 * @param domain - The domain to extract tenant from (e.g., 'aprendecoding.com')
 * @returns The tenant ID or 'blocomanager' as default
 */
export function getTenantFromDomain(domain: string): string {
  // Remove port number if present (e.g., localhost:3002 -> localhost)
  const cleanDomain = domain.split(':')[0];
  
  return TENANT_DOMAIN_MAPPING[cleanDomain] || 'blocomanager';
}

/**
 * Get tenant configuration by tenant ID
 * @param tenantId - The tenant ID
 * @returns The tenant configuration or null if not found
 */
export function getTenantConfig(tenantId: string): TenantConfig | null {
  return TENANT_CONFIGS[tenantId] || null;
}

/**
 * Validate if a tenant exists
 * @param tenantId - The tenant ID to validate
 * @returns true if tenant exists, false otherwise
 */
export function isValidTenant(tenantId: string): boolean {
  return tenantId in TENANT_CONFIGS;
}