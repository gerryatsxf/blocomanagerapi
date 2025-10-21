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
import { TenantService } from '../tenant/tenant.service';

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
    private readonly tenantService: TenantService,
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

        // Get tenant from session for customized content
        const tenant = sessionInfo.tenant || 'blocomanager';
        const tenantConfig = this.tenantService.getTenantConfig(tenant);
        
        // Update existing calendar event using videoMeeting.event_id with tenant-specific content
        const eventTitle = this.getTenantEventTitle(tenant, customerName);
        const eventDescription = this.getTenantEventDescription(
          tenant,
          customerName,
          customerEmail,
          '', // hostMeetingLink - keeping empty as in original
        );


        console.log('Updating event with event_id:', videoMeeting);
        const eventId = videoMeeting.data.event_id;

        await this.nylasService.updateEvent(eventId, {
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
              subject: this.getTenantNotificationSubject(tenant),
              body: this.getTenantNotificationBody(tenant, customerName),
            },
          ],
          notifyParticipants: true,
        });
        console.log('Event updated successfully with event_id:', eventId);

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

  /**
   * Get tenant-specific event title
   */
  getTenantEventTitle(tenant: string, customerName: string): string {
    const tenantConfig = this.tenantService.getTenantConfig(tenant);
    const brandName = tenantConfig?.name || 'BlocoManager';
    
    switch (tenant) {
      case 'aprendecoding':
        return `Sesión de Mentoría con ${brandName} - ${customerName}`;
      case 'pedrorivero':
        return `Consultoría Personalizada - ${customerName}`;
      default:
        return `Asesoría de ${customerName}`;
    }
  }

  /**
   * Get tenant-specific event description
   */
  getTenantEventDescription(tenant: string, customerName: string, customerEmail: string, hostLink: string): string {
    const tenantConfig = this.tenantService.getTenantConfig(tenant);
    const brandName = tenantConfig?.name || 'BlocoManager';
    const domain = tenantConfig?.domain || 'blocomanager.com';

    switch (tenant) {
      case 'aprendecoding':
        return `
        ¡Hola, ${customerName}! 👋
        
        ¡Bienvenido/a a ${brandName}! 🎓
        
        Gracias por confiar en nosotros para tu crecimiento profesional en programación. 
        Has agendado una sesión de mentoría personalizada donde resolveremos tus dudas 
        y te ayudaremos a acelerar tu aprendizaje.
        
        📧 Email: ${customerEmail}
        🔗 Link de videollamada: ${hostLink}
        
        ¡Nos vemos pronto y sigamos aprendiendo juntos!
        
        El equipo de ${brandName}
        ${domain}
        `;

      case 'pedrorivero':
        return `
        Hola ${customerName},
        
        Es un placer tenerte como cliente. Has agendado una consultoría 
        personalizada donde trabajaremos juntos en tu proyecto y objetivos específicos.
        
        Detalles de contacto: ${customerEmail}
        Enlace de reunión: ${hostLink}
        
        Estoy emocionado de trabajar contigo.
        
        Saludos cordiales,
        Pedro Rivero
        ${domain}
        `;

      default:
        return this.getEventDescription(customerName, customerEmail, hostLink);
    }
  }

  /**
   * Get tenant-specific notification subject
   */
  getTenantNotificationSubject(tenant: string): string {
    const tenantConfig = this.tenantService.getTenantConfig(tenant);
    const brandName = tenantConfig?.name || 'BlocoManager';

    switch (tenant) {
      case 'aprendecoding':
        return `🎓 Recordatorio: Tu sesión de mentoría con ${brandName}`;
      case 'pedrorivero':
        return `📅 Recordatorio de tu consultoría personalizada`;
      default:
        return 'Recordatorio de reunión - BlocoManager';
    }
  }

  /**
   * Get tenant-specific notification body
   */
  getTenantNotificationBody(tenant: string, customerName: string): string {
    const tenantConfig = this.tenantService.getTenantConfig(tenant);
    const brandName = tenantConfig?.name || 'BlocoManager';

    switch (tenant) {
      case 'aprendecoding':
        return `¡Hola ${customerName}! Te recordamos que tienes una sesión de mentoría programada con ${brandName}. ¡Te esperamos para seguir aprendiendo juntos! 🚀`;
      case 'pedrorivero':
        return `Hola ${customerName}, este es un recordatorio de tu consultoría personalizada. Nos vemos pronto para trabajar en tu proyecto.`;
      default:
        return `Te recordamos tu próxima reunión con ${brandName}.`;
    }
  }





}
