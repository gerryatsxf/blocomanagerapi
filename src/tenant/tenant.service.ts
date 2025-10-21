import { Injectable } from '@nestjs/common';
import { Request } from 'express';
import { 
  getTenantFromDomain, 
  getTenantConfig, 
  isValidTenant, 
  TENANT_DOMAIN_MAPPING
} from './config/tenant.config';
import { TenantConfig } from './interfaces/tenant-config.interface';

@Injectable()
export class TenantService {
  
  /**
   * Extract tenant from HTTP request based on Host header
   * @param request - Express request object
   * @returns The tenant ID
   */
  extractTenantFromRequest(request: Request): string {
    const origin = request.get('origin');
    
    let tenantDomain: string;
    
    if (origin) {
      // For CORS requests, extract domain from Origin header
      try {
        const originUrl = new URL(origin);
        tenantDomain = originUrl.hostname;
      } catch (e) {
        tenantDomain = 'blocomanager.com'; // Fallback to default
      }
    } else {
      // For same-origin requests, use default tenant
      tenantDomain = 'blocomanager.com';
    }
    
    // Validate domain is allowed
    const allowedDomains = Object.keys(TENANT_DOMAIN_MAPPING);
    if (!allowedDomains.includes(tenantDomain)) {
      tenantDomain = 'blocomanager.com';
    }
    
    return getTenantFromDomain(tenantDomain);
  }

  /**
   * Get tenant configuration
   * @param tenantId - The tenant ID
   * @returns Tenant configuration or null
   */
  getTenantConfig(tenantId: string): TenantConfig | null {
    return getTenantConfig(tenantId);
  }

  /**
   * Validate tenant existence
   * @param tenantId - The tenant ID to validate
   * @returns true if tenant exists
   */
  isValidTenant(tenantId: string): boolean {
    return isValidTenant(tenantId);
  }

  /**
   * Get tenant from domain string
   * @param domain - Domain to extract tenant from
   * @returns Tenant ID
   */
  getTenantFromDomain(domain: string): string {
    return getTenantFromDomain(domain);
  }

  /**
   * Validate request has valid tenant
   * @param request - Express request object
   * @throws Error if tenant is invalid
   */
  validateRequestTenant(request: Request): void {
    const tenant = this.extractTenantFromRequest(request);
    if (!this.isValidTenant(tenant)) {
      throw new Error(`Invalid tenant: ${tenant}`);
    }
  }
}