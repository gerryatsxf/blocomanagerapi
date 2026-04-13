import { Controller, Get, Param, Body, Post, NotFoundException, Headers } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { TENANT_CONFIGS } from './config/tenant.config';
import { TenantConfig } from './interfaces/tenant-config.interface';
import { DeploymentWebhookDto } from './dto/deployment-webhook.dto';
import { ProductService } from '../product/product.service';
import { isPlatformId } from '../common/platform.constants';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';

@ApiTags('Tenant Public API')
@Controller('api/tenant-public')
export class TenantPublicController {
  constructor(
    private readonly productService: ProductService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Get tenant configuration by tenant ID (public endpoint for tenant frontends)
   */
  @Get(':tenantId')
  @ApiOperation({ summary: 'Get tenant configuration by ID' })
  async getTenantConfig(@Param('tenantId') tenantId: string): Promise<TenantConfig> {
    const tenant = TENANT_CONFIGS[tenantId];
    
    if (!tenant) {
      throw new NotFoundException(`Tenant with ID "${tenantId}" not found`);
    }

    // Return public configuration (exclude sensitive data)
    return {
      tenantId: tenant.tenantId,
      domain: tenant.domain,
      name: tenant.name,
      description: tenant.description,
      settings: tenant.settings,
      frontendUrl: tenant.frontendUrl,
      deploymentStatus: tenant.deploymentStatus,
    };
  }

  /**
   * Get tenant configuration by subdomain
   */
  @Get('subdomain/:subdomain')
  @ApiOperation({ summary: 'Get tenant configuration by subdomain' })
  async getTenantBySubdomain(@Param('subdomain') subdomain: string): Promise<TenantConfig> {
    const tenant = Object.values(TENANT_CONFIGS).find(
      config => config.domain === subdomain
    );

    if (!tenant) {
      throw new NotFoundException(`Tenant with subdomain "${subdomain}" not found`);
    }

    return {
      tenantId: tenant.tenantId,
      domain: tenant.domain,
      name: tenant.name,
      description: tenant.description,
      settings: tenant.settings,
      frontendUrl: tenant.frontendUrl,
      deploymentStatus: tenant.deploymentStatus,
    };
  }

  /**
   * Get products for a specific tenant (public endpoint)
   */
  @Get(':tenantId/products')
  @ApiOperation({ summary: 'Get all products for a tenant' })
  async getTenantProducts(@Param('tenantId') tenantId: string) {
    const tenant = TENANT_CONFIGS[tenantId];
    
    if (!tenant) {
      throw new NotFoundException(`Tenant with ID "${tenantId}" not found`);
    }

    // Get all active products for this tenant
    const products = await this.productService.findAll();
    
    // Filter by tenant if products have tenant field
    return products.filter((product: any) => 
      !product.tenant || product.tenant === tenantId || isPlatformId(product.tenant)
    );
  }

  /**
   * Get specific product for a tenant
   */
  @Get(':tenantId/products/:productId')
  @ApiOperation({ summary: 'Get specific product for a tenant' })
  async getTenantProduct(
    @Param('tenantId') tenantId: string,
    @Param('productId') productId: string
  ) {
    const tenant = TENANT_CONFIGS[tenantId];
    
    if (!tenant) {
      throw new NotFoundException(`Tenant with ID "${tenantId}" not found`);
    }

    const product = await this.productService.findOne(productId);
    
    // Verify product belongs to this tenant
    if ((product as any).tenant && (product as any).tenant !== tenantId && !isPlatformId((product as any).tenant)) {
      throw new NotFoundException(`Product not found for this tenant`);
    }

    return product;
  }

  /**
   * Webhook endpoint to receive deployment status updates from provisioning server
   */
  @Post('provisioning-webhook')
  @ApiOperation({ summary: 'Receive deployment status webhook' })
  async handleProvisioningWebhook(
    @Body() webhookData: DeploymentWebhookDto,
    @Headers('x-webhook-signature') signature: string,
  ) {
    // Verify webhook signature
    const isValid = this.verifyWebhookSignature(webhookData, signature);
    
    if (!isValid) {
      throw new Error('Invalid webhook signature');
    }

    const { tenantId, status, containerId, url, error, deploymentId } = webhookData;

    console.log(`📦 Provisioning webhook received for tenant: ${tenantId}, status: ${status}`);

    // Update tenant configuration with deployment status
    const tenant = TENANT_CONFIGS[tenantId];
    
    if (!tenant) {
      console.error(`Tenant ${tenantId} not found when processing webhook`);
      return { success: false, message: 'Tenant not found' };
    }

    // Update deployment fields
    tenant.deploymentStatus = status;
    tenant.deploymentId = deploymentId;
    
    if (status === 'deployed') {
      tenant.containerId = containerId;
      tenant.frontendUrl = url;
      tenant.deployedAt = new Date().toISOString();
      console.log(`✅ Tenant ${tenantId} deployed successfully at ${url}`);
    } else if (status === 'failed') {
      console.error(`❌ Deployment failed for tenant ${tenantId}: ${error}`);
    } else if (status === 'undeployed') {
      tenant.containerId = undefined;
      tenant.frontendUrl = undefined;
      tenant.deployedAt = undefined;
      console.log(`🗑️ Tenant ${tenantId} undeployed`);
    }

    return {
      success: true,
      message: `Webhook processed successfully for tenant ${tenantId}`,
    };
  }

  /**
   * Verify webhook signature using HMAC
   */
  private verifyWebhookSignature(payload: any, signature: string): boolean {
    if (!signature) {
      console.warn('No webhook signature provided');
      return false;
    }

    const secret = this.configService.get<string>('PROVISIONING_WEBHOOK_SECRET');
    
    if (!secret) {
      console.warn('PROVISIONING_WEBHOOK_SECRET not configured. Skipping signature verification.');
      return true; // Allow in development if secret not set
    }

    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(JSON.stringify(payload))
      .digest('hex');

    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    );
  }
}
