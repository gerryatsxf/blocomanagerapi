import { Injectable, CanActivate, ExecutionContext, ForbiddenException, Logger } from '@nestjs/common';
import { UsersService } from '../../users/users.service';
import { UserRole } from '../../users/entities/user.entity';

@Injectable()
export class PlatformOwnerGuard implements CanActivate {
  private readonly logger = new Logger(PlatformOwnerGuard.name);
  
  constructor(private usersService: UsersService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const session = request.user;

    this.logger.log(`PlatformOwnerGuard - Session: ${JSON.stringify(session)}`);

    if (!session || !session.userId) {
      this.logger.warn('PlatformOwnerGuard - No session or userId');
      throw new ForbiddenException('Authentication required');
    }

    const user = await this.usersService.findById(session.userId);
    
    this.logger.log(`PlatformOwnerGuard - User: ${user?.email}, Role: ${user?.role}`);
    
    if (!user) {
      this.logger.warn('PlatformOwnerGuard - User not found');
      throw new ForbiddenException('User not found');
    }

    if (user.role !== UserRole.PLATFORM_OWNER) {
      this.logger.warn(`PlatformOwnerGuard - Access denied for role: ${user.role}`);
      throw new ForbiddenException('Platform owner access required');
    }

    this.logger.log(`PlatformOwnerGuard - Access granted for: ${user.email}`);
    // Attach user to request for later use
    request.adminUser = user;
    return true;
  }
}
