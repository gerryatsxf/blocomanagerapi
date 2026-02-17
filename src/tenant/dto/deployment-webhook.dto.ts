import { IsString, IsNotEmpty, IsOptional, IsIn } from 'class-validator';

export class DeploymentWebhookDto {
  @IsString()
  @IsNotEmpty()
  deploymentId: string;

  @IsString()
  @IsNotEmpty()
  tenantId: string;

  @IsString()
  @IsNotEmpty()
  subdomain: string;

  @IsString()
  @IsNotEmpty()
  @IsIn(['provisioning', 'deployed', 'failed', 'undeployed'])
  status: 'provisioning' | 'deployed' | 'failed' | 'undeployed';

  @IsString()
  @IsOptional()
  containerId?: string;

  @IsString()
  @IsOptional()
  url?: string;

  @IsString()
  @IsOptional()
  error?: string;

  @IsString()
  @IsNotEmpty()
  timestamp: string;
}
