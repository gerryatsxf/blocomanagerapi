import { Injectable } from '@nestjs/common';
import { Request } from 'express';
import { 
  getTenantFromDomain, 
  getTenantConfig, 
  isValidTenant, 
  TenantConfig,
  TENANT_DOMAIN_MAPPING
} from '../config/multitenant.config';

@Injectable()
export class TenantService {
  
  /**
   * Extract tenant from HTTP request based on Host header
   * @param request - Express request object
   * @returns The tenant ID
   */
  extractTenantFromRequest(request: Request): string {
    // Get all possible host headers for debugging
    const host = request.get('host');
    const xForwardedHost = request.get('x-forwarded-host');
    const xOriginalHost = request.get('x-original-host');
    const referer = request.get('referer');
    const origin = request.get('origin');
    
    console.log('=== TENANT EXTRACTION DEBUG ===');
    console.log('Host:', host);
    console.log('X-Forwarded-Host:', xForwardedHost);
    console.log('X-Original-Host:', xOriginalHost);
    console.log('Referer:', referer);
    console.log('Origin:', origin);
    console.log('URL:', request.url);
    console.log('Method:', request.method);
    console.log('All headers:', JSON.stringify(request.headers, null, 2));
    
    // Use Host header first, fallback to localhost
    // Note: x-forwarded-host is not used for security reasons (can be spoofed)
    let finalHost: string;
    if (host) {
      finalHost = host;
      console.log('Using Host header');
    } else {
      finalHost = 'localhost';
      console.log('Fallback to localhost');
    }
    
    // Additional security: validate the host against allowed domains
    const cleanHost = finalHost.split(':')[0];
    const allowedDomains = Object.keys(TENANT_DOMAIN_MAPPING);
    
    if (!allowedDomains.includes(cleanHost)) {
      console.warn(`⚠️  SECURITY WARNING: Unknown domain detected: ${cleanHost}`);
      console.warn(`⚠️  Allowed domains: ${allowedDomains.join(', ')}`);
      console.warn(`⚠️  Falling back to default tenant for security`);
      // Return default tenant for unknown domains
      finalHost = 'blocomanager.com';
    }
    
    console.log('Final host selected:', finalHost);
    const tenant = getTenantFromDomain(finalHost);
    console.log('Extracted tenant:', tenant);
    console.log('=== END TENANT DEBUG ===');
    
    return tenant;
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