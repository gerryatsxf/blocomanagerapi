import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Contact } from './entities/contact.schema';
import { CreateContactRequestDto } from './dto/create-contact-request.dto';
import { CreateContactResponseDto } from './dto/create-contact-response.dto';
import { NotificationService } from '../notification/notification.service';
import * as crypto from 'crypto';

@Injectable()
export class ContactService {
  constructor(
    @InjectModel(Contact.name)
    private readonly contactModel: Model<Contact>,
    private readonly notificationService: NotificationService,
  ) {}

  /**
   * Generate unique reference ID for contact request
   * Format: CR-YYYYMMDD-XXXXXX
   */
  private generateReferenceId(): string {
    const date = new Date();
    const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '');
    const randomStr = crypto.randomBytes(3).toString('hex').toUpperCase();
    return `CR-${dateStr}-${randomStr}`;
  }

  /**
   * Create a new contact request
   */
  async create(
    createContactRequestDto: CreateContactRequestDto,
  ): Promise<CreateContactResponseDto> {
    const { name, email, subject, priority, message } = createContactRequestDto;

    // Generate unique reference ID
    const referenceId = this.generateReferenceId();

    // Create contact document
    const contact = new this.contactModel({
      name,
      email,
      subject,
      priority,
      message,
      referenceId,
      createdAt: new Date(),
    });

    await contact.save();

    console.log(`📬 New contact request: ${referenceId} from ${email} (${priority} priority)`);

    // Send email notifications (fire and forget - don't block response)
    this.sendEmailNotifications(name, email, subject, priority, message, referenceId)
      .catch(error => console.error('Failed to send contact email notifications:', error));

    return {
      success: true,
      message: 'Your message has been received. We will get back to you shortly.',
      referenceId,
    };
  }

  /**
   * Send email notifications to user and support team
   */
  private async sendEmailNotifications(
    name: string,
    email: string,
    subject: string,
    priority: string,
    message: string,
    referenceId: string,
  ): Promise<void> {
    const priorityEmoji = {
      low: '📋',
      medium: '📨',
      high: '⚠️',
      urgent: '🚨',
    }[priority] || '📬';

    // 1. Send confirmation email to user
    const userSubject = `We received your message - ${referenceId}`;
    const userHtmlBody = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background-color: #4CAF50; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
    .content { background-color: #f9f9f9; padding: 30px; border: 1px solid #ddd; border-top: none; }
    .reference-box { background-color: #e8f5e9; border-left: 4px solid #4CAF50; padding: 15px; margin: 20px 0; border-radius: 4px; }
    .reference-id { font-size: 18px; font-weight: bold; color: #2e7d32; }
    .info-box { background-color: #fff; border: 1px solid #ddd; padding: 15px; margin: 20px 0; border-radius: 4px; }
    .footer { text-align: center; padding: 20px; font-size: 12px; color: #666; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Thank You for Contacting Us!</h1>
    </div>
    <div class="content">
      <p>Hi ${name},</p>
      
      <p>Thank you for reaching out to BlocoManager. We have received your message and will get back to you as soon as possible.</p>
      
      <div class="reference-box">
        <p style="margin: 0;"><strong>Your Reference ID:</strong></p>
        <p class="reference-id">${referenceId}</p>
        <p style="margin: 5px 0 0 0; font-size: 12px; color: #666;">Please save this reference number for future correspondence.</p>
      </div>

      <div class="info-box">
        <h3 style="margin-top: 0;">Your Message Details:</h3>
        <p><strong>Subject:</strong> ${subject}</p>
        <p><strong>Priority:</strong> ${priority.toUpperCase()}</p>
        <p><strong>Message:</strong></p>
        <p style="background: #f5f5f5; padding: 10px; border-radius: 4px; white-space: pre-wrap;">${message}</p>
      </div>

      <p><strong>What happens next?</strong></p>
      <ul>
        <li>Our support team will review your message</li>
        <li>You'll receive a response within 24-48 hours (urgent requests are handled faster)</li>
        <li>All updates will be sent to: <strong>${email}</strong></li>
      </ul>

      <p>If you have any urgent concerns, please reply to this email with your reference ID.</p>
      
      <p>Best regards,<br>
      <strong>The BlocoManager Support Team</strong></p>
    </div>
    <div class="footer">
      <p>This is an automated confirmation email.</p>
      <p>&copy; ${new Date().getFullYear()} BlocoManager. All rights reserved.</p>
    </div>
  </div>
</body>
</html>
`;

    const userTextBody = `
Hi ${name},

Thank you for reaching out to BlocoManager. We have received your message and will get back to you as soon as possible.

Your Reference ID: ${referenceId}
Please save this reference number for future correspondence.

Your Message Details:
Subject: ${subject}
Priority: ${priority.toUpperCase()}
Message: ${message}

What happens next?
- Our support team will review your message
- You'll receive a response within 24-48 hours (urgent requests are handled faster)
- All updates will be sent to: ${email}

If you have any urgent concerns, please reply to this email with your reference ID.

Best regards,
The BlocoManager Support Team

This is an automated confirmation email.
© ${new Date().getFullYear()} BlocoManager. All rights reserved.
`;

    // 2. Send notification to support team
    const supportEmail = 'blocomanager@gmail.com';
    const supportSubject = `${priorityEmoji} New Contact Request: ${subject} [${referenceId}]`;
    const supportHtmlBody = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 700px; margin: 0 auto; padding: 20px; }
    .header { background-color: #2196F3; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
    .priority-${priority} { background-color: ${this.getPriorityColor(priority)}; color: white; padding: 5px 15px; border-radius: 20px; display: inline-block; font-weight: bold; }
    .content { background-color: #f9f9f9; padding: 30px; border: 1px solid #ddd; border-top: none; }
    .info-section { background-color: #fff; border: 1px solid #ddd; padding: 20px; margin: 15px 0; border-radius: 4px; }
    .label { font-weight: bold; color: #555; display: inline-block; min-width: 120px; }
    .message-box { background: #f5f5f5; padding: 15px; border-radius: 4px; border-left: 4px solid #2196F3; margin: 15px 0; white-space: pre-wrap; }
    .action-buttons { text-align: center; margin: 25px 0; }
    .button { display: inline-block; padding: 12px 24px; margin: 5px; background-color: #4CAF50; color: white; text-decoration: none; border-radius: 4px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>${priorityEmoji} New Contact Request</h1>
      <p style="margin: 5px 0 0 0;">Reference: ${referenceId}</p>
    </div>
    <div class="content">
      <div class="info-section">
        <p><span class="label">Priority:</span> <span class="priority-${priority}">${priority.toUpperCase()}</span></p>
        <p><span class="label">Reference ID:</span> ${referenceId}</p>
        <p><span class="label">Date/Time:</span> ${new Date().toLocaleString()}</p>
      </div>

      <div class="info-section">
        <h3 style="margin-top: 0; color: #2196F3;">Contact Information</h3>
        <p><span class="label">Name:</span> ${name}</p>
        <p><span class="label">Email:</span> <a href="mailto:${email}">${email}</a></p>
        <p><span class="label">Subject:</span> ${subject}</p>
      </div>

      <div class="info-section">
        <h3 style="margin-top: 0; color: #2196F3;">Message</h3>
        <div class="message-box">${message}</div>
      </div>

      <div class="action-buttons">
        <a href="mailto:${email}?subject=Re: ${subject} [${referenceId}]" class="button">Reply to Customer</a>
      </div>

      <p style="font-size: 12px; color: #666; text-align: center; margin-top: 30px;">
        This contact request was automatically logged in the database.<br>
        User received confirmation email with reference ID: ${referenceId}
      </p>
    </div>
  </div>
</body>
</html>
`;

    const supportTextBody = `
${priorityEmoji} NEW CONTACT REQUEST

Reference ID: ${referenceId}
Priority: ${priority.toUpperCase()}
Date/Time: ${new Date().toLocaleString()}

CONTACT INFORMATION
Name: ${name}
Email: ${email}
Subject: ${subject}

MESSAGE
${message}

---
This contact request was automatically logged in the database.
User received confirmation email with reference ID: ${referenceId}

Reply to: ${email}
`;

    // Send both emails
    try {
      await Promise.all([
        this.notificationService['sendGmailEmail'](email, userSubject, userHtmlBody, userTextBody),
        this.notificationService['sendGmailEmail'](supportEmail, supportSubject, supportHtmlBody, supportTextBody),
      ]);
      console.log(`✅ Contact emails sent: confirmation to ${email} and notification to ${supportEmail}`);
    } catch (error) {
      console.error('Error sending contact emails:', error);
      // Log to console as fallback
      console.log('\n' + '='.repeat(80));
      console.log('📧 CONTACT REQUEST EMAIL (Console Fallback)');
      console.log('='.repeat(80));
      console.log(`To User: ${email}`);
      console.log(`Subject: ${userSubject}`);
      console.log(userTextBody);
      console.log('\n' + '-'.repeat(80));
      console.log(`To Support: ${supportEmail}`);
      console.log(`Subject: ${supportSubject}`);
      console.log(supportTextBody);
      console.log('='.repeat(80) + '\n');
    }
  }

  /**
   * Get color for priority badge
   */
  private getPriorityColor(priority: string): string {
    const colors = {
      low: '#4CAF50',
      medium: '#FF9800',
      high: '#FF5722',
      urgent: '#F44336',
    };
    return colors[priority] || '#2196F3';
  }
}
