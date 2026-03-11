import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Request } from 'express';
import { 
  getTenantFromDomain, 
  getTenantConfig, 
  isValidTenant, 
  TENANT_DOMAIN_MAPPING,
  TENANT_CONFIGS,
  addTenantToConfig,
} from './config/tenant.config';
import { TenantConfig } from './interfaces/tenant-config.interface';
import { Tenant, TenantDocument } from './schemas/tenant.schema';

@Injectable()
export class TenantService implements OnModuleInit {
  private readonly logger = new Logger(TenantService.name);

  constructor(
    @InjectModel(Tenant.name)
    private tenantModel: Model<TenantDocument>,
  ) {}

  /**
   * On startup, load all tenant configs from DB into TENANT_DOMAIN_MAPPING / TENANT_CONFIGS
   * so that dynamic tenants created at runtime survive server restarts.
   */
  async onModuleInit() {
    try {
      const tenants = await this.tenantModel.find().exec();
      for (const t of tenants) {
        // Merge DB tenants into in-memory maps (DB wins if conflict)
        TENANT_DOMAIN_MAPPING[t.domain] = t.tenantId;
        if (!TENANT_CONFIGS[t.tenantId]) {
          TENANT_CONFIGS[t.tenantId] = {
            tenantId: t.tenantId,
            domain: t.domain,
            name: t.name,
            description: t.description,
            storageProvider: t.storageProvider || 'local',
          };
        }
      }

      // Seed hardcoded tenants that don't exist in DB yet
      for (const [domain, tenantId] of Object.entries(TENANT_DOMAIN_MAPPING)) {
        const config = TENANT_CONFIGS[tenantId];
        if (config) {
          const exists = await this.tenantModel.findOne({ tenantId }).exec();
          if (!exists) {
            await this.tenantModel.create({
              tenantId: config.tenantId,
              domain: config.domain,
              name: config.name,
              description: config.description,
              storageProvider: config.storageProvider || 'local',
            });
            this.logger.log(`Seeded tenant to DB: ${tenantId} (${domain})`);
          }
        }
      }

      this.logger.log(`Loaded ${tenants.length} tenants from DB. Total mapped domains: ${Object.keys(TENANT_DOMAIN_MAPPING).length}`);
    } catch (error) {
      this.logger.warn(`Failed to load tenants from DB (may not exist yet): ${error.message}`);
    }
  }

  /**
   * Persist a new tenant to MongoDB and register in-memory
   */
  async createTenant(config: TenantConfig): Promise<Tenant> {
    // Save to DB
    const tenant = await this.tenantModel.findOneAndUpdate(
      { tenantId: config.tenantId },
      {
        tenantId: config.tenantId,
        domain: config.domain,
        name: config.name,
        description: config.description,
        storageProvider: config.storageProvider || 'local',
      },
      { upsert: true, new: true },
    );

    // Register in-memory
    addTenantToConfig(config);

    this.logger.log(`Created/updated tenant: ${config.tenantId} (${config.domain})`);
    return tenant;
  }
  
  /**
   * Extract tenant from HTTP request based on Host header
   * @param request - Express request object
   * @returns The tenant ID
   */
  extractTenantFromRequest(request: Request): string {
    // In non-production environments, allow X-Tenant-ID header override
    // so local frontends on any port can specify which tenant to use
    if (process.env.NODE_ENV !== 'production') {
      const headerTenant = request.get('X-Tenant-ID') || request.get('x-tenant-id');
      if (headerTenant && isValidTenant(headerTenant)) {
        return headerTenant;
      }
    }

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