import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { UsersService } from '../../users/users.service';
import { UserRole } from '../../users/entities/user.entity';

@Injectable()
export class SuperAdminGuard implements CanActivate {
  constructor(private usersService: UsersService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const session = request.user;

    if (!session || !session.userId) {
      throw new ForbiddenException('Authentication required');
    }

    const user = await this.usersService.findById(session.userId);
    
    if (!user) {
      throw new ForbiddenException('User not found');
    }

    if (user.role !== UserRole.SUPER_ADMIN) {
      throw new ForbiddenException('Super admin access required');
    }

    // Attach user to request for later use
    request.adminUser = user;
    return true;
  }
}
