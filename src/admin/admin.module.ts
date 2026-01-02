import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { User, UserSchema } from '../users/entities/user.entity';
import { Subscription, SubscriptionSchema } from '../subscription/entities/subscription.schema';
import { SuperAdminGrant, SuperAdminGrantSchema } from './entities/super-admin-grant.entity';
import { UsersModule } from '../users/users.module';
import { SessionModule } from '../session/session.module';
import { NotificationModule } from '../notification/notification.module';
import { SuperAdminGuard } from './guards/super-admin.guard';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: Subscription.name, schema: SubscriptionSchema },
      { name: SuperAdminGrant.name, schema: SuperAdminGrantSchema },
    ]),
    UsersModule,
    SessionModule,
    NotificationModule,
  ],
  controllers: [AdminController],
  providers: [AdminService, SuperAdminGuard],
  exports: [AdminService],
})
export class AdminModule {}
