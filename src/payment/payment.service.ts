import { Injectable } from '@nestjs/common';
import Stripe from 'stripe';
import 'dotenv/config';
import { NotificationService } from 'src/notification/notification.service';
import { plainToInstance } from 'class-transformer';
import { StripeSessionCompletedDto } from './dto/stripe-session-completed.dto';
import { MeetingService } from '../meeting/meeting.service';
import { BookingService } from '../booking/booking.service';
import { IBooking } from '../booking/entities/booking.interface';
import { CalendarService } from '../calendar/calendar.service';
import { ScheduleEventParamsDto } from '../calendar/dto/schedule-event-params.dto';
import { SessionService } from '../session/session.service';
import { NylasService } from '../nylas/nylas.service';
import { CreateMeetingResultDto } from 'src/meeting/dto/create-meeting-result.dto';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2022-11-15',
});

@Injectable()
export class PaymentService {
  constructor(
    private notificationService: NotificationService,
    private readonly bookingService: BookingService,
    private readonly meetingService: MeetingService,
    private readonly calendarService: CalendarService,
    private readonly sessionService: SessionService,
    private readonly nylasService: NylasService,
  ) {}

  async paymentSuccess(request, stripeSignature, endpointSecret, response) {
    // Make sure this event was sent from Stripe
    let event;

    try {
      event = stripe.webhooks.constructEvent(
        request.rawBody,
        stripeSignature,
        endpointSecret,
      );
    } catch (err) {
      response.sendStatus(400).send(`Webhook Error: ${err.message}`);
      return;
    }

    const stripeSessionCompleted = plainToInstance(
      StripeSessionCompletedDto,
      event.data.object,
    );

    // Fetch session info
    const clientReferenceId = stripeSessionCompleted.client_reference_id;
    const sessionInfo = await this.sessionService.findByClientReferenceId(
      clientReferenceId,
    );

    // Handle the checkout.session.completed event
    switch (event.type) {
      case 'checkout.session.completed':
        // Search for booking reservation in DB
        const booking: IBooking =
          await this.bookingService.getBookingBySessionId(sessionInfo.id);
        if (!booking) {
          response.sendStatus(400).send(`Booking not found`);
          return;
        }
        // console.log({ booking });
        // Create vonage meeting
        const customerEmail = stripeSessionCompleted.customer_details.email;
        const customerName = stripeSessionCompleted.customer_details.name;

        // Create vonage meeting with timestamp and invitee parameters
        const videoMeeting = await this.meetingService.createMeetingWithParams(
          booking.meetingStartTimestamp,
          customerName
        );
        // console.log({ videoMeeting });
        
        // Update existing calendar event using videoMeeting.event_id
        const eventTitle = 'Asesoría de ' + customerName;
        const eventDescription = this.getEventDescription(
          customerName,
          customerEmail,
          '', // hostMeetingLink - keeping empty as in original
        );

        await this.nylasService.updateEvent(videoMeeting.data.event_id, {
          title: eventTitle,
          description: eventDescription,
          startTime: booking.meetingStartTimestamp,
          endTime: booking.meetingEndTimestamp,
          participants: [
            {
              name: customerName,
              email: customerEmail,
            },
          ],
          busy: true,
          metadata: { event_type: booking.type },
          notifications: [
            {
              type: 'email',
              minutesBeforeEvent: 600,
              subject: 'Recordatorio de reunión - BlocoManager',
              body: 'Te recordamos tu próxima reunión con BlocoManager.',
            },
          ],
          notifyParticipants: true,
        });
        console.log('Event updated successfully with event_id:', videoMeeting.data.event_id);

        // Update booking and session status
        await this.bookingService.updateBookingStatus(booking.id, 'paid');
        break;

      default:
        console.log(`Unhandled event type ${event.type}`);
    }

    response.sendStatus(200);
  }

  getEventDescription(customerName, customerEmail, hostLink) {
    return `
      Hola, ${customerName} (${customerEmail}).
        \n
        \n Nos da mucho gusto saludarte. 
        \n
        \n Te damos una cálida bienvenida de parte de blocomanager.com :) 
        \n Has agendado una sesión de reunión. Más abajo te compartimos el link de la reunión. 
        \n 
        \n Te esperamos! 
        \n
        \n Link de videollamada: ${hostLink}
        \n
        \n Atentamente, 
        \n blocomanager.com
    `;
  }





}
