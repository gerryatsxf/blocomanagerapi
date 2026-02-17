import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance } from 'axios';
import { TenantConfig } from './interfaces/tenant-config.interface';

@Injectable()
export class ProvisioningService {
  private readonly logger = new Logger(ProvisioningService.name);
  private readonly httpClient: AxiosInstance;
  private readonly provisioningServerUrl: string;
  private readonly apiKey: string;

  constructor(private configService: ConfigService) {
    this.provisioningServerUrl = this.configService.get<string>('PROVISIONING_SERVER_URL');
    this.apiKey = this.configService.get<string>('PROVISIONING_API_KEY');

    if (!this.provisioningServerUrl) {
      this.logger.warn('PROVISIONING_SERVER_URL not configured. Provisioning features disabled.');
    }

    this.httpClient = axios.create({
      baseURL: this.provisioningServerUrl,
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': this.apiKey,
      },
      timeout: 30000,
    });
  }

  /**
   * Check if provisioning is enabled
   */
  isEnabled(): boolean {
    return !!this.provisioningServerUrl && !!this.apiKey;
  }

  /**
   * Request provisioning of a new tenant frontend
   */
  async provisionTenant(tenantConfig: TenantConfig): Promise<{ deploymentId: string; status: string }> {
    if (!this.isEnabled()) {
      this.logger.warn('Provisioning disabled. Skipping tenant provisioning.');
      return { deploymentId: null, status: 'disabled' };
    }

    try {
      this.logger.log(`Requesting provisioning for tenant: ${tenantConfig.tenantId}`);

      const callbackUrl = `${this.configService.get<string>('API_BASE_URL')}/api/tenant/provisioning-webhook`;
      const baseDomain = this.configService.get<string>('BASE_DOMAIN') || 'blocomanager.com';

      const response = await this.httpClient.post('/provision', {
        tenantId: tenantConfig.tenantId,
        subdomain: tenantConfig.domain,
        databaseUrl: this.configService.get<string>('MONGO_DB_CONNECTION_STRING'),
        callbackUrl,
        apiKey: this.generateTenantApiKey(tenantConfig.tenantId),
      });

      this.logger.log(`Provisioning request sent successfully. Deployment ID: ${response.data.deploymentId}`);

      return {
        deploymentId: response.data.deploymentId,
        status: response.data.status || 'provisioning',
      };
    } catch (error) {
      this.logger.error(`Failed to provision tenant ${tenantConfig.tenantId}:`, error.message);
      throw new Error(`Provisioning request failed: ${error.message}`);
    }
  }

  /**
   * Check deployment status
   */
  async getDeploymentStatus(deploymentId: string): Promise<any> {
    if (!this.isEnabled()) {
      return { status: 'disabled' };
    }

    try {
      const response = await this.httpClient.get(`/status/${deploymentId}`);
      return response.data;
    } catch (error) {
      this.logger.error(`Failed to get deployment status for ${deploymentId}:`, error.message);
      throw new Error(`Status check failed: ${error.message}`);
    }
  }

  /**
   * Undeploy a tenant (remove container and nginx config)
   */
  async undeployTenant(tenantId: string): Promise<{ status: string; message: string }> {
    if (!this.isEnabled()) {
      this.logger.warn('Provisioning disabled. Cannot undeploy tenant.');
      return { status: 'disabled', message: 'Provisioning is disabled' };
    }

    try {
      this.logger.log(`Requesting undeploy for tenant: ${tenantId}`);

      const response = await this.httpClient.delete(`/undeploy/${tenantId}`);

      this.logger.log(`Tenant ${tenantId} undeployed successfully`);

      return {
        status: response.data.status || 'undeployed',
        message: response.data.message || 'Tenant undeployed successfully',
      };
    } catch (error) {
      this.logger.error(`Failed to undeploy tenant ${tenantId}:`, error.message);
      throw new Error(`Undeploy request failed: ${error.message}`);
    }
  }

  /**
   * List all tenant containers
   */
  async listTenantContainers(): Promise<any[]> {
    if (!this.isEnabled()) {
      return [];
    }

    try {
      const response = await this.httpClient.get('/tenants');
      return response.data.containers || [];
    } catch (error) {
      this.logger.error('Failed to list tenant containers:', error.message);
      return [];
    }
  }

  /**
   * Generate a unique API key for a tenant
   */
  private generateTenantApiKey(tenantId: string): string {
    const crypto = require('crypto');
    return crypto
      .createHash('sha256')
      .update(`${tenantId}-${Date.now()}-${Math.random()}`)
      .digest('hex');
  }
}
