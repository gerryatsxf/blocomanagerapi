export interface TenantConfig {
  tenantId: string;
  domain: string;
  name: string;
  description?: string;
}

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
  
  console.log('=== DOMAIN TO TENANT MAPPING DEBUG ===');
  console.log('Original domain:', domain);
  console.log('Clean domain (no port):', cleanDomain);
  console.log('Available mappings:', TENANT_DOMAIN_MAPPING);
  console.log('Found mapping:', TENANT_DOMAIN_MAPPING[cleanDomain]);
  console.log('Final tenant:', TENANT_DOMAIN_MAPPING[cleanDomain] || 'blocomanager');
  console.log('=== END MAPPING DEBUG ===');
  
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