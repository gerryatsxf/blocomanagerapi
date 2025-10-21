import { 
  Injectable, 
  CanActivate, 
  ExecutionContext, 
  BadRequestException,
  Logger,
  SetMetadata 
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { TenantService } from '../tenant.service';
import { TenantId } from '../interfaces';

/**
 * Metadata key for required tenants
 */
export const REQUIRED_TENANTS_KEY = 'required_tenants';

/**
 * Decorator to specify required tenants for a route
 * Usage: @RequiredTenants(['aprendecoding', 'pedrorivero'])
 */
export const RequiredTenants = (tenants: TenantId[]) => 
  SetMetadata(REQUIRED_TENANTS_KEY, tenants);

@Injectable()
export class TenantGuard implements CanActivate {
  private readonly logger = new Logger(TenantGuard.name);

  constructor(
    private readonly tenantService: TenantService,
    private readonly reflector: Reflector,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    
    try {
      // Extract tenant from request
      const tenant = this.tenantService.extractTenantFromRequest(request);
      
      // Validate tenant exists
      if (!this.tenantService.isValidTenant(tenant)) {
        this.logger.warn(`Invalid tenant detected: ${tenant}`);
        throw new BadRequestException(`Invalid tenant: ${tenant}`);
      }

      // Check if specific tenants are required for this route
      const requiredTenants = this.reflector.getAllAndOverride<TenantId[]>(
        REQUIRED_TENANTS_KEY,
        [context.getHandler(), context.getClass()],
      );

      if (requiredTenants && requiredTenants.length > 0) {
        if (!requiredTenants.includes(tenant as TenantId)) {
          this.logger.warn(
            `Tenant ${tenant} not allowed. Required: ${requiredTenants.join(', ')}`,
          );
          throw new BadRequestException(
            `Access denied for tenant: ${tenant}`,
          );
        }
      }

      // Store tenant in request for later use
      request.tenant = tenant;
      request.tenantConfig = this.tenantService.getTenantConfig(tenant);

      this.logger.debug(`Request validated for tenant: ${tenant}`);
      return true;
      
    } catch (error) {
      this.logger.error(`Tenant validation failed: ${error.message}`);
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException('Tenant validation failed');
    }
  }
}