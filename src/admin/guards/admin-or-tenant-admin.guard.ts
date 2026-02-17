import { Injectable, CanActivate, ExecutionContext, ForbiddenException, Logger } from '@nestjs/common';
import { UsersService } from '../../users/users.service';
import { UserRole } from '../../users/entities/user.entity';

@Injectable()
export class AdminOrTenantAdminGuard implements CanActivate {
  private readonly logger = new Logger(AdminOrTenantAdminGuard.name);
  
  constructor(private usersService: UsersService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const session = request.user;

    this.logger.log(`AdminOrTenantAdminGuard - Session: ${JSON.stringify(session)}`);

    if (!session || !session.userId) {
      this.logger.warn('AdminOrTenantAdminGuard - No session or userId');
      throw new ForbiddenException('Authentication required');
    }

    const user = await this.usersService.findById(session.userId);
    
    this.logger.log(`AdminOrTenantAdminGuard - User: ${user?.email}, Role: ${user?.role}`);
    
    if (!user) {
      this.logger.warn('AdminOrTenantAdminGuard - User not found');
      throw new ForbiddenException('User not found');
    }

    // Allow both super admins and tenant admins
    if (user.role !== UserRole.SUPER_ADMIN && user.role !== UserRole.TENANT_ADMIN) {
      this.logger.warn(`AdminOrTenantAdminGuard - Access denied for role: ${user.role}`);
      throw new ForbiddenException('Admin access required');
    }

    this.logger.log(`AdminOrTenantAdminGuard - Access granted for: ${user.email}`);
    // Attach user to request for later use
    request.adminUser = user;
    return true;
  }
}
