import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { AppService } from './app.service';
import { AppController } from './app.controller';
import { PaymentModule } from './payment/payment.module';
import { MeetingModule } from './meeting/meeting.module';
import { NotificationModule } from './notification/notification.module';
import { CalendarModule } from './calendar/calendar.module';
import { AvailabilityModule } from './availability/availability.module';
import { FreeSlotModule } from './free-slot/free-slot.module';
import { DateTimeModule } from './date-time/date-time.module';
import { SessionModule } from './session/session.module';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import * as dotenv from 'dotenv';
import * as path from 'path';
import { AuthModule } from './auth/auth.module';
import { BookingModule } from './booking/booking.module';
import { ProductModule } from './product/product.module';
import { CartModule } from './cart/cart.module';
import { ChatModule } from './chat/chat.module';
import { TenantModule } from './tenant/tenant.module';
import { EmailChangeModule } from './email-change/email-change.module';
import { ContactModule } from './contact/contact.module';
import { AdminModule } from './admin/admin.module';
import { TemplateModule } from './template/template.module';
import { SubscriptionModule } from './subscription/subscription.module';
import { StorageConfigModule } from './storage-config/storage-config.module';
import { RequestLoggerMiddleware } from './common/middleware/request-logger.middleware';

@Module({
  imports: [
    TenantModule,
    AuthModule,
    EmailChangeModule,
    ContactModule,
    AdminModule,
    TemplateModule,
    ScheduleModule.forRoot(),
    ThrottlerModule.forRoot([{
      ttl: 60000, // 60 seconds = 1 minute
      limit: 10, // 10 requests per minute (default for most endpoints)
    }]),
    PaymentModule,
    MeetingModule,
    NotificationModule,
    CalendarModule,
    AvailabilityModule,
    FreeSlotModule,
    DateTimeModule,
    SessionModule,
    ConfigModule.forRoot({
      envFilePath: process.env.DOCKER_ENV ? undefined : path.resolve(__dirname, '../env/dev.env'),
      isGlobal: true,
    }),
    MongooseModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => {
        const MONGO_DB_CONNECTION_URL = configService.get<string>('MONGO_DB_CONNECTION_STRING');
        console.log('MongoDB Connection URL:', MONGO_DB_CONNECTION_URL);
        return {
          uri: MONGO_DB_CONNECTION_URL,
        };

        // // return { uri: 'mongodb://admin_root:admin_root@localhost:27017/?authSource=admin&authMechanism=SCRAM-SHA-1' };
        // // return { uri: 'mongodb://admin_root:admin_root@host.docker.internal:27017/?authSource=admin&authMechanism=SCRAM-SHA-1' };
        // return { uri: 'mongodb://admin_root:admin_root@mongodb:27017/?authSource=admin&authMechanism=SCRAM-SHA-1' };

      },
      inject: [ConfigService],
    }),
    BookingModule,
    ProductModule,
    CartModule,
    ChatModule,
    SubscriptionModule,
    StorageConfigModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(RequestLoggerMiddleware).forRoutes('*');
  }
}
