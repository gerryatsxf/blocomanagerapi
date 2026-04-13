import { Request } from 'express';

export interface TenantRequest extends Request {
  tenant?: string;
  tenantConfig?: import('./tenant-config.interface').TenantConfig;
}

export interface TenantContext {
  tenantId: string;
  domain: string;
  config: import('./tenant-config.interface').TenantConfig;
}

/**
 * Known tenant IDs. Note: 'blocomanager' is the PLATFORM_ID (not a tenant).
 * Use isPlatformId() from platform.constants.ts to check for it.
 */
export type TenantId = 'aprendecoding' | 'pedrorivero' | 'development';

export interface TenantDomainMapping {
  [domain: string]: string;
}