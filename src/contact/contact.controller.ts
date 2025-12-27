import { Controller, Post, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBody, ApiBearerAuth } from '@nestjs/swagger';
import { ContactService } from './contact.service';
import { CreateContactRequestDto, ContactPriority } from './dto/create-contact-request.dto';
import { CreateContactResponseDto } from './dto/create-contact-response.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('Contact')
@Controller('contact')
export class ContactController {
  constructor(private readonly contactService: ContactService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ 
    summary: 'Submit a contact/support request',
    description: `Endpoint for visitors to submit contact form inquiries or support requests. Requires a valid session token (visitor or authenticated).

**Use Cases:**
• General inquiries about the platform
• Technical support requests
• Feature requests or feedback
• Billing or account questions
• Bug reports

**Priority Levels:**
• \`low\` - General questions, non-urgent feedback
• \`medium\` - Standard support requests (default)
• \`high\` - Issues affecting functionality
• \`urgent\` - Critical issues requiring immediate attention

**Response:**
Returns a unique reference ID that can be used to track the request status.

**Frontend Implementation:**
\`\`\`typescript
const response = await fetch('/contact', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    name: 'John Doe',
    email: 'user@example.com',
    subject: 'Cannot schedule meetings',
    priority: 'medium',
    message: 'I am having trouble with the scheduling feature...'
  })
});

if (response.ok) {
  const data = await response.json();
  // { 
  //   success: true, 
  //   message: "Your message has been received...",
  //   referenceId: "CR-20251222-ABC123"
  // }
  
  // Show success message with reference ID
  alert('Request submitted! Reference ID: ' + data.referenceId);
}
\`\`\`

**Email Notifications:**
• User receives confirmation email with reference ID
• Support team receives notification of new request
• Priority requests are highlighted

**Authentication Required:**
Requires a valid session token (visitor or authenticated user session).`
  })
  @ApiBody({ 
    type: CreateContactRequestDto,
    examples: {
      general: {
        summary: 'General inquiry',
        value: {
          name: 'John Doe',
          email: 'john.doe@example.com',
          subject: 'Question about pricing plans',
          priority: 'low',
          message: 'I would like to know more about your enterprise pricing options. Can you provide more details about features included?'
        }
      },
      technical: {
        summary: 'Technical support',
        value: {
          name: 'Jane Smith',
          email: 'jane.smith@example.com',
          subject: 'Calendar sync not working',
          priority: 'high',
          message: 'My Google Calendar is not syncing with BlocoManager. I have tried reconnecting but the issue persists. Please help.'
        }
      },
      urgent: {
        summary: 'Urgent issue',
        value: {
          name: 'Bob Johnson',
          email: 'bob.johnson@example.com',
          subject: 'Unable to access account',
          priority: 'urgent',
          message: 'I cannot log into my account. Password reset emails are not arriving. I have an important meeting scheduled today.'
        }
      }
    }
  })
  @ApiResponse({ 
    status: 201, 
    description: 'Contact request submitted successfully',
    type: CreateContactResponseDto,
    schema: {
      example: {
        success: true,
        message: 'Your message has been received. We will get back to you shortly.',
        referenceId: 'CR-20251222-ABC123'
      }
    }
  })
  @ApiResponse({ 
    status: 401, 
    description: 'Unauthorized - Invalid or missing session token',
    schema: {
      example: {
        statusCode: 401,
        message: 'Unauthorized',
        error: 'Unauthorized'
      }
    }
  })
  @ApiResponse({ 
    status: 400, 
    description: 'Bad request - validation failed',
    schema: {
      oneOf: [
        {
          description: 'Missing required fields',
          example: {
            statusCode: 400,
            message: ['name should not be empty', 'email must be an email'],
            error: 'Bad Request'
          }
        },
        {
          description: 'Invalid priority value',
          example: {
            statusCode: 400,
            message: ['priority must be one of the following values: low, medium, high, urgent'],
            error: 'Bad Request'
          }
        },
        {
          description: 'Message too short',
          example: {
            statusCode: 400,
            message: ['message must be longer than or equal to 10 characters'],
            error: 'Bad Request'
          }
        },
        {
          description: 'Subject too long',
          example: {
            statusCode: 400,
            message: ['subject must be shorter than or equal to 200 characters'],
            error: 'Bad Request'
          }
        }
      ]
    }
  })
  async create(
    @Body() createContactRequestDto: CreateContactRequestDto,
  ): Promise<CreateContactResponseDto> {
    return this.contactService.create(createContactRequestDto);
  }
}
