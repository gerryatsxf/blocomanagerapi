import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { User, UserSchema } from '../users/entities/user.entity';
import { Subscription, SubscriptionSchema } from '../subscription/entities/subscription.schema';
import { UsersModule } from '../users/users.module';
import { SessionModule } from '../session/session.module';
import { SuperAdminGuard } from './guards/super-admin.guard';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: Subscription.name, schema: SubscriptionSchema },
    ]),
    UsersModule,
    SessionModule,
  ],
  controllers: [AdminController],
  providers: [AdminService, SuperAdminGuard],
  exports: [AdminService],
})
export class AdminModule {}
