import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SendNotificationRequestDto } from './dto/send-notification-request.dto';
import { NylasService } from '../nylas/nylas.service';

@Injectable()
export class NotificationService {
  constructor(
    private configService: ConfigService,
    private nylasService: NylasService,
  ) {}

  async sendNotification(
    notificationRequest: SendNotificationRequestDto,
    meeting: any,
  ) {
    console.log('meeting', meeting);
    console.log('notificationRequest', notificationRequest);
    // For now, using a simple object structure instead of Draft class
    const draftData = {
      subject: `¡Hola, ${notificationRequest.guestName}! Gracias por agendar`,
      body: `
        Hola, ${notificationRequest.guestName}
        \n<br>
        \n<br> Nos da mucho gusto saludarte. 
        \n<br>
        \n<br> Te damos una cálido bienvenida de parte de aprendecoding.com :) 
        \n<br> Has agendado una sesión de asesoría para el XX de XX del XXXX a las XX:XX pm. 
        \n<br> Más abajo te compartimos el link de la reunión. 
        \n<br> Te esperamos! 
        \n<br>
        \n<br> Link de videollamada: ${meeting._links.guest_url.href}
        \n<br>
        \n<br> Atentamente, 
        \n<br> aprendecoding.com`,
      to: [
        {
          name: notificationRequest.guestName,
          email: notificationRequest.email,
        },
      ],
    };
    // TODO: Implement this with the new Nylas API for sending emails
    console.log('Draft data ready:', draftData);
    return draftData;
  }
}
