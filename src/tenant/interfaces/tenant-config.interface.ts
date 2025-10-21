export interface TenantConfig {
  tenantId: string;
  domain: string;
  name: string;
  description?: string;
  settings?: TenantSettings;
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
}