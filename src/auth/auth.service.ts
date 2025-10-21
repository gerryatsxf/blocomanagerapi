import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { SessionService } from '../session/session.service';
import { TenantService } from '../tenant/tenant.service';
import { Request } from 'express';

@Injectable()
export class AuthService {
  constructor(
    private sessionService: SessionService,
    private jwtService: JwtService, //private readonly encryptionService: EncryptionService,
    private tenantService: TenantService,
  ) {}

  // async validateUser(email: string, password: string): Promise<any> {
  //   const session = await this.sessionService.findById()
  //   const user = await this.usersService.findByEmail(email);
  //   const comparison = this.encryptionService.compare(
  //     password,
  //     (user as Record<string, any>).password,
  //   );
  //   if (user && comparison) {
  //     return user;
  //   }
  //   return null;
  // }

  // async login(user: any) {
  //   const payload = { username: user.username, sub: user.userId };
  //   return {
  //     access_token: this.jwtService.sign(payload),
  //   };
  // }

  async createToken(request?: Request): Promise<any> {
    // Extract tenant from request if provided, otherwise use default
    let tenant = 'blocomanager'; // default tenant
    if (request) {
      tenant = this.tenantService.extractTenantFromRequest(request);
      console.log(`Creating session for tenant: ${tenant} from host: ${request.get('host')}`);
    }
    
    const session = await this.sessionService.create(tenant);
    return {
      access_token: this.jwtService.sign({
        id: session.id,
      }),
    };
  }

  async deleteToken(leadId: string): Promise<any> {
    // Logic to delete the token or session
    // This could involve invalidating the JWT or removing the session from the database
    const session = await this.sessionService.findByLeadId(leadId);
    console.log({session})
    const udpated = await this.sessionService.update(session.id, { status: 'processed', leadId: `${session.leadId}_stale` });
    console.log({ udpated });
    return { message: 'Session deleted successfully' };
  }
}
