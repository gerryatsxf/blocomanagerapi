// Main module
export { TenantModule } from './tenant.module';
export { TenantService } from './tenant.service';
export { GoogleOAuthService } from './google-oauth.service';

// Interfaces and types
export { 
  TenantConfig, 
  TenantSettings 
} from './interfaces/tenant-config.interface';
export { 
  TenantRequest, 
  TenantContext, 
  TenantId, 
  TenantDomainMapping 
} from './interfaces/tenant.interface';

// Decorators
export { Tenant, TenantConfig as TenantConfigDecorator } from './decorators/tenant.decorator';

// Guards
export { TenantGuard, RequiredTenants } from './guards/tenant.guard';

// Configuration
export { 
  TENANT_DOMAIN_MAPPING, 
  TENANT_CONFIGS, 
  getTenantFromDomain, 
  getTenantConfig, 
  isValidTenant 
} from './config/tenant.config';