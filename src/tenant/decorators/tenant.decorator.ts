import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import {
  getTenantFromDomain,
  getTenantConfig as getTenantConfigFn,
  isValidTenant,
  TENANT_DOMAIN_MAPPING,
} from '../config/tenant.config';
import { isPlatformDomain, PLATFORM_DOMAINS } from '../config/platform.config';
import { PLATFORM_ID } from '../../common/platform.constants';

/**
 * Extract tenant from request using static config maps (no DI needed).
 * The in-memory maps are populated on startup by TenantService.onModuleInit().
 */
function extractTenantFromRequest(request: any): string {
  // In non-production environments, allow X-Tenant-ID header override
  if (process.env.NODE_ENV !== 'production') {
    const headerTenant = request.get?.('X-Tenant-ID') || request.get?.('x-tenant-id');
    if (headerTenant && isValidTenant(headerTenant)) {
      return headerTenant;
    }
  }

  const origin = request.get?.('origin');
  let tenantDomain: string;

  if (origin) {
    try {
      const originUrl = new URL(origin);
      tenantDomain = originUrl.hostname;
    } catch (e) {
      tenantDomain = 'blocomanager.com'; // Falls through to platform check below
    }
  } else {
    tenantDomain = 'blocomanager.com'; // Falls through to platform check below
  }

  // Check if it's a platform domain first
  if (isPlatformDomain(tenantDomain)) {
    return PLATFORM_ID;
  }

  // Check if domain is an allowed tenant domain
  const allowedDomains = Object.keys(TENANT_DOMAIN_MAPPING);
  if (!allowedDomains.includes(tenantDomain)) {
    return PLATFORM_ID; // Unknown domain defaults to platform
  }

  return getTenantFromDomain(tenantDomain);
}

/**
 * Decorator to extract tenant from request
 * Usage: @Tenant() tenant: string
 */
export const Tenant = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): string => {
    const request = ctx.switchToHttp().getRequest();
    
    // Check if tenant is already extracted and stored in request
    if (request.tenant) {
      return request.tenant;
    }
    
    const tenant = extractTenantFromRequest(request);
    request.tenant = tenant;
    
    return tenant;
  },
);

/**
 * Decorator to extract tenant configuration from request
 * Usage: @TenantConfig() tenantConfig: TenantConfig
 */
export const TenantConfig = createParamDecorator(
  (data: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    
    // Check if tenant config is already extracted
    if (request.tenantConfig) {
      return request.tenantConfig;
    }
    
    const tenant = extractTenantFromRequest(request);
    const tenantConfig = getTenantConfigFn(tenant);
    
    request.tenant = tenant;
    request.tenantConfig = tenantConfig;
    
    return tenantConfig;
  },
);