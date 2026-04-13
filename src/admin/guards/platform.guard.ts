import { Injectable, CanActivate, ExecutionContext, ForbiddenException, Logger } from '@nestjs/common';
import { UsersService } from '../../users/users.service';
import { isPlatformRole } from '../../common/platform.constants';

/**
 * PlatformGuard — allows both PLATFORM_OWNER and PLATFORM_MANAGER roles.
 * Use this for operations that platform managers can perform
 * (e.g., tenant support, monitoring, non-sensitive config).
 */
@Injectable()
export class PlatformGuard implements CanActivate {
  private readonly logger = new Logger(PlatformGuard.name);
  
  constructor(private usersService: UsersService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const session = request.user;

    this.logger.log(`PlatformGuard - Session: ${JSON.stringify(session)}`);

    if (!session || !session.userId) {
      this.logger.warn('PlatformGuard - No session or userId');
      throw new ForbiddenException('Authentication required');
    }

    const user = await this.usersService.findById(session.userId);
    
    this.logger.log(`PlatformGuard - User: ${user?.email}, Role: ${user?.role}`);
    
    if (!user) {
      this.logger.warn('PlatformGuard - User not found');
      throw new ForbiddenException('User not found');
    }

    if (!isPlatformRole(user.role)) {
      this.logger.warn(`PlatformGuard - Access denied for role: ${user.role}`);
      throw new ForbiddenException('Platform access required');
    }

    this.logger.log(`PlatformGuard - Access granted for: ${user.email}`);
    request.adminUser = user;
    return true;
  }
}
