import { Module } from '@nestjs/common';
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
import * as dotenv from 'dotenv';
import * as path from 'path';
import { AuthModule } from './auth/auth.module';
import { BookingModule } from './booking/booking.module';
import { ProductModule } from './product/product.module';
import { CartModule } from './cart/cart.module';
import { ChatModule } from './chat/chat.module';
@Module({
  imports: [
    AuthModule,
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
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
