export interface TenantResourceConfig {
  enabled: boolean;
}

export interface TenantResources {
  adminPanel: TenantResourceConfig;
  visitorSite: TenantResourceConfig;
  dedicatedServer: TenantResourceConfig;
}

export type InfrastructureType = 'shared' | 'dedicated';

export interface TenantConfig {
  tenantId: string;
  domain: string;
  name: string;
  description?: string;
  settings?: TenantSettings;
  storageProvider?: string; // 'local', 'aws_s3', 'azure_blob', 'google_cloud'
  storageConfig?: Record<string, any>; // Provider-specific storage configuration
  // Infrastructure
  infrastructureType?: InfrastructureType;
  resources?: TenantResources;
  // Deployment information
  frontendUrl?: string;
  deploymentStatus?: 'pending' | 'provisioning' | 'deployed' | 'failed' | 'undeployed';
  deployedAt?: string;
  containerId?: string;
  deploymentId?: string;
}

export interface PaymentProviderConfig {
  provider: string;
  enabled: boolean;
  config: Record<string, any>; // Flexible config for any provider
}

export interface TenantSettings {
  // Email configuration
  emailSettings?: {
    fromName?: string;
    fromEmail?: string;
    signature?: string;
  };
  
  // Branding
  branding?: {
    primaryColor?: string;
    logoUrl?: string;
    favicon?: string;
  };
  
  // Feature flags
  features?: {
    enableNotifications?: boolean;
    enableCalendarIntegration?: boolean;
    enablePayments?: boolean;
    customDomain?: boolean;
  };
  
  // Billing settings
  billing?: {
    currency?: string;
    taxRate?: number;
    defaultPricing?: number;
  };

  // Payment provider configurations
  paymentProviders?: PaymentProviderConfig[];
}