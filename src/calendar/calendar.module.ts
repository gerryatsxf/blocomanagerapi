import { Module, forwardRef } from '@nestjs/common';
import { CalendarService } from './calendar.service';
import { CalendarController } from './calendar.controller';
import { NylasModule } from '../nylas/nylas.module';
import { CalendarWebhookController } from './calendar-webhook.controller';
import { CalendarProviderFactory } from './services/calendar-provider.factory';
import { WebhookSubscriptionService } from './services/webhook-subscription.service';
import { TenantModule } from '../tenant/tenant.module';
import { MeetingModule } from '../meeting/meeting.module';

@Module({
  imports: [
    NylasModule, 
    forwardRef(() => TenantModule),
    forwardRef(() => MeetingModule),
  ],
  controllers: [CalendarController, CalendarWebhookController],
  providers: [CalendarService, CalendarProviderFactory, WebhookSubscriptionService],
  exports: [CalendarService, CalendarProviderFactory, WebhookSubscriptionService],
})
export class CalendarModule {}
