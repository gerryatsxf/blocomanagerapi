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
import { GoogleCalendarService } from '../tenant/google-calendar.service';
import { GoogleOAuthService } from '../tenant/google-oauth.service';
import { getTenantConfig } from '../tenant/config/tenant-email.config';

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
    private readonly googleCalendarService: GoogleCalendarService,
    private readonly googleOAuthService: GoogleOAuthService,
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
        // Create google calendar event
        const customerEmail = stripeSessionCompleted.customer_details.email;
        const customerName = stripeSessionCompleted.customer_details.name;

        // Note: Replaced old Make webhook system with direct Google Calendar API integration
        // const videoMeeting = await this.meetingService.createMeetingWithParams(
        //   booking.meetingStartTimestamp,
        //   customerName
        // );

        // Get tenant from session for customized content
        const tenant = sessionInfo.tenant || 'blocomanager';
        const tenantConfig = this.tenantService.getTenantConfig(tenant);
        
        // Get first authorized provider for the tenant (the main provider who will be the organizer)
        const tenantEmailConfig = getTenantConfig(tenant);
        const providerEmail = tenantEmailConfig?.authorizedProviders?.[0];
        if (!providerEmail) {
          console.error(`No authorized providers found for tenant: ${tenant}`);
          response.sendStatus(400).send(`No providers configured for tenant`);
          return;
        }

        // Get stored OAuth tokens for the provider
        console.log(`🔍 DEBUG Payment - Looking for tokens:`, {
          tenant,
          providerEmail,
        });
        
        const providerTokens = await this.googleOAuthService.getStoredTokens(tenant, providerEmail);
        
        console.log(`🔍 DEBUG Payment - Retrieved tokens:`, {
          found: !!providerTokens,
          tokensKeys: providerTokens ? Object.keys(providerTokens) : null,
          tokenSubKeys: providerTokens?.tokens ? Object.keys(providerTokens.tokens) : null,
          hasAccessToken: providerTokens?.tokens?.accessToken ? 'yes' : 'no',
          hasAccess_token: providerTokens?.tokens?.access_token ? 'yes' : 'no',
        });
        
        if (!providerTokens) {
          console.error(`No OAuth tokens found for provider: ${providerEmail} in tenant: ${tenant}`);
          // Don't fail the payment, just log the error and continue
          console.log('Skipping calendar event creation due to missing OAuth tokens');
        } else {
          // Prepare event details
          const eventTitle = this.getTenantEventTitle(tenant, customerName);
          const eventDescription = this.getTenantEventDescription(
            tenant,
            customerName,
            customerEmail,
            '', // hostMeetingLink - keeping empty as in original
          );

          // Create event directly in provider's Google Calendar
          console.log(`Creating calendar event for tenant: ${tenant}, provider: ${providerEmail}`);
          
          console.log(`🔍 DEBUG Payment - Booking timestamps:`, {
            meetingStartTimestamp: booking.meetingStartTimestamp,
            meetingStartTimestampType: typeof booking.meetingStartTimestamp,
            meetingEndTimestamp: booking.meetingEndTimestamp,
            meetingEndTimestampType: typeof booking.meetingEndTimestamp,
            rawBooking: booking
          });
          
          try {
            // Fix timestamp conversion - ensure we're working with milliseconds
            let startTimestamp = booking.meetingStartTimestamp;
            let endTimestamp = booking.meetingEndTimestamp;
            
            // If timestamps are in seconds, convert to milliseconds
            if (startTimestamp < 1000000000000) {
              startTimestamp = startTimestamp * 1000;
              endTimestamp = endTimestamp * 1000;
              console.log(`🔧 DEBUG - Converted timestamps from seconds to milliseconds`);
            }
            
            const eventStartTime = new Date(startTimestamp);
            const eventEndTime = new Date(endTimestamp);
            
            console.log(`🔍 DEBUG Payment - Converted dates:`, {
              originalStart: booking.meetingStartTimestamp,
              originalEnd: booking.meetingEndTimestamp,
              convertedStart: startTimestamp,
              convertedEnd: endTimestamp,
              eventStartTime: eventStartTime.toISOString(),
              eventEndTime: eventEndTime.toISOString(),
              isValidStart: !isNaN(eventStartTime.getTime()),
              isValidEnd: !isNaN(eventEndTime.getTime()),
            });

            console.log(`🔍 DEBUG Payment - Calling createEvent with tokens:`, {
              tokensStructure: providerTokens.tokens ? Object.keys(providerTokens.tokens) : 'no tokens',
            });

            const calendarEvent = await this.googleCalendarService.createEvent(
              providerTokens.tokens,
              {
                title: eventTitle,
                description: eventDescription,
                startTime: eventStartTime,
                endTime: eventEndTime,
                attendees: [
                  {
                    email: customerEmail,
                    displayName: customerName,
                  },
                ],
                timezone: 'America/Mexico_City', // You can make this configurable per tenant
              }
            );

            console.log('Calendar event created successfully:', calendarEvent.id);
          } catch (error) {
            console.error('Error creating calendar event:', error);
            // Don't fail the payment, just log the error
          }
        }

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
