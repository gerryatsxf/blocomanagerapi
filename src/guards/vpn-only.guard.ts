import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';

@Injectable()
export class VpnOnlyGuard implements CanActivate {
  private readonly allowedIps: string[];

  constructor(private configService: ConfigService) {
    const ipsString = this.configService.get<string>('VPN_ALLOWED_IPS', '');
    this.allowedIps = ipsString
      .split(',')
      .map(ip => ip.trim())
      .filter(ip => ip.length > 0);
    
    console.log('VPN Allowed IPs:', this.allowedIps);
  }

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const clientIp = this.getClientIp(request);

    console.log('Client IP:', clientIp);

    // If no IPs are configured, allow access (development mode)
    if (this.allowedIps.length === 0) {
      console.warn('⚠️  VPN_ALLOWED_IPS not configured - allowing all IPs (DEVELOPMENT MODE)');
      return true;
    }

    // Check if client IP is in whitelist
    const isAllowed = this.allowedIps.some(allowedIp => {
      // Support CIDR notation in the future, for now exact match
      return clientIp === allowedIp || allowedIp === clientIp;
    });

    if (!isAllowed) {
      throw new ForbiddenException(
        `Access denied. This endpoint is only accessible via VPN. Your IP: ${clientIp}`,
      );
    }

    return true;
  }

  private getClientIp(request: Request): string {
    // Check various headers that might contain the real IP
    const xForwardedFor = request.headers['x-forwarded-for'];
    const xRealIp = request.headers['x-real-ip'];
    const cfConnectingIp = request.headers['cf-connecting-ip']; // Cloudflare

    if (xForwardedFor) {
      // X-Forwarded-For can contain multiple IPs, take the first one
      const ips = (xForwardedFor as string).split(',');
      return ips[0].trim();
    }

    if (xRealIp) {
      return xRealIp as string;
    }

    if (cfConnectingIp) {
      return cfConnectingIp as string;
    }

    // Fallback to socket IP
    return request.ip || request.socket.remoteAddress || 'unknown';
  }
}
