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

        // Create vonage meeting
        // const videoMeeting = await this.meetingService.createMeeting();
        // console.log({ videoMeeting });
        //
        // Create calendar event
        const eventParams = new ScheduleEventParamsDto();
        eventParams.title = 'Asesoría de ' + customerName;
        eventParams.description =
          '¡Hola, ' +
          customerName +
          '! Es un gusto saludarte, gracias por agendar con BlocoManager. En breve recibirás un correo con los detalles de tu reunión, gracias por tu preferencia. ¡Nos vemos pronto!';
        // eventParams.guestMeetingLink = videoMeeting._links.guest_url.href;
        // eventParams.hostMeetingLink = videoMeeting._links.host_url.href;
        eventParams.hostMeetingLink = ''
        eventParams.guestMeetingLink = ''
        eventParams.description = this.getEventDescription(
          customerName,
          customerEmail,
          eventParams.hostMeetingLink,
        );
        eventParams.eventStartTime = booking.meetingStartTimestamp;
        eventParams.eventEndTime = booking.meetingEndTimestamp;
        eventParams.meetingType = booking.type;
        
        eventParams.customerEmail = customerEmail;
        eventParams.customerName = customerName;
        await this.calendarService.scheduleEvent(eventParams);
        console.log('it was scheduled!');

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
