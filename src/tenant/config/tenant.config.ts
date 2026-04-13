import { TenantConfig } from '../interfaces/tenant-config.interface';
import { PLATFORM_ID, isPlatformId } from '../../common/platform.constants';
import { isPlatformDomain, PLATFORM_CONFIG } from './platform.config';

export const TENANT_DOMAIN_MAPPING: Record<string, string> = {
  'aprendecoding.com': 'aprendecoding',
  'pedrorivero.com': 'pedrorivero',
  'localhost': 'development', // For local development
};

export const TENANT_CONFIGS: Record<string, TenantConfig> = {
  aprendecoding: {
    tenantId: 'aprendecoding',
    domain: 'aprendecoding.com',
    name: 'Aprende Coding',
    description: 'Coding education platform',
    storageProvider: 'local',
  },
  pedrorivero: {
    tenantId: 'pedrorivero',
    domain: 'pedrorivero.com',
    name: 'Pedro Rivero',
    description: 'Personal consulting services',
    storageProvider: 'local',
  },
  development: {
    tenantId: 'development',
    domain: 'localhost',
    name: 'Development Environment',
    description: 'Local development tenant',
    storageProvider: 'local',
  },
};

/**
 * Extract tenant ID from domain
 * @param domain - The domain to extract tenant from (e.g., 'aprendecoding.com')
 * @returns The tenant ID, or PLATFORM_ID for platform domains
 */
export function getTenantFromDomain(domain: string): string {
  // Remove port number if present (e.g., localhost:3002 -> localhost)
  const cleanDomain = domain.split(':')[0];

  // Check if this is a platform domain first
  if (isPlatformDomain(cleanDomain)) {
    return PLATFORM_ID;
  }
  
  return TENANT_DOMAIN_MAPPING[cleanDomain] || PLATFORM_ID;
}

/**
 * Get tenant configuration by tenant ID.
 * Returns platform config when tenantId matches PLATFORM_ID.
 * @param tenantId - The tenant ID (or PLATFORM_ID)
 * @returns The tenant configuration or null if not found
 */
export function getTenantConfig(tenantId: string): TenantConfig | null {
  if (isPlatformId(tenantId)) {
    return {
      tenantId: PLATFORM_CONFIG.id,
      domain: PLATFORM_CONFIG.domain,
      name: PLATFORM_CONFIG.name,
      description: PLATFORM_CONFIG.description,
    };
  }
  return TENANT_CONFIGS[tenantId] || null;
}

/**
 * Validate if a tenant exists (or if it's the platform)
 * @param tenantId - The tenant ID to validate
 * @returns true if tenant exists or is the platform ID, false otherwise
 */
export function isValidTenant(tenantId: string): boolean {
  return isPlatformId(tenantId) || tenantId in TENANT_CONFIGS;
}

/**
 * Add a new tenant to the configuration dynamically
 * @param config - The tenant configuration to add
 * @returns The added tenant configuration
 */
export function addTenantToConfig(config: TenantConfig): TenantConfig {
  TENANT_CONFIGS[config.tenantId] = config;
  TENANT_DOMAIN_MAPPING[config.domain] = config.tenantId;
  return config;
}

/**
 * Remove a tenant from in-memory configuration
 * @param tenantId - The tenant ID to remove
 */
export function removeTenantFromConfig(tenantId: string): void {
  const config = TENANT_CONFIGS[tenantId];
  if (config) {
    delete TENANT_DOMAIN_MAPPING[config.domain];
    delete TENANT_CONFIGS[tenantId];
  }
}