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

export type TenantId = 'aprendecoding' | 'pedrorivero' | 'blocomanager' | 'development';

export interface TenantDomainMapping {
  [domain: string]: TenantId;
}