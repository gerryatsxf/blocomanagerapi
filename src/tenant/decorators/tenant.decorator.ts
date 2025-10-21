import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { TenantService } from '../tenant.service';

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
    
    // Extract tenant using TenantService logic
    const tenantService = new TenantService();
    const tenant = tenantService.extractTenantFromRequest(request);
    
    // Store in request for subsequent uses
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
    
    // Extract tenant and get config
    const tenantService = new TenantService();
    const tenant = tenantService.extractTenantFromRequest(request);
    const tenantConfig = tenantService.getTenantConfig(tenant);
    
    // Store in request for subsequent uses
    request.tenant = tenant;
    request.tenantConfig = tenantConfig;
    
    return tenantConfig;
  },
);