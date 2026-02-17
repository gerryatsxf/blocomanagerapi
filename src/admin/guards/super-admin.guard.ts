import { Injectable, CanActivate, ExecutionContext, ForbiddenException, Logger } from '@nestjs/common';
import { UsersService } from '../../users/users.service';
import { UserRole } from '../../users/entities/user.entity';

@Injectable()
export class SuperAdminGuard implements CanActivate {
  private readonly logger = new Logger(SuperAdminGuard.name);
  
  constructor(private usersService: UsersService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const session = request.user;

    this.logger.log(`SuperAdminGuard - Session: ${JSON.stringify(session)}`);

    if (!session || !session.userId) {
      this.logger.warn('SuperAdminGuard - No session or userId');
      throw new ForbiddenException('Authentication required');
    }

    const user = await this.usersService.findById(session.userId);
    
    this.logger.log(`SuperAdminGuard - User: ${user?.email}, Role: ${user?.role}`);
    
    if (!user) {
      this.logger.warn('SuperAdminGuard - User not found');
      throw new ForbiddenException('User not found');
    }

    if (user.role !== UserRole.SUPER_ADMIN) {
      this.logger.warn(`SuperAdminGuard - Access denied for role: ${user.role}`);
      throw new ForbiddenException('Super admin access required');
    }

    this.logger.log(`SuperAdminGuard - Access granted for: ${user.email}`);
    // Attach user to request for later use
    request.adminUser = user;
    return true;
  }
}
