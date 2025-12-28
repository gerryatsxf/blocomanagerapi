import { ApiProperty } from '@nestjs/swagger';

export class SubscriptionDto {
  @ApiProperty({
    description: 'Subscription plan ID',
    example: 'free',
  })
  planId: string;

  @ApiProperty({
    description: 'Plan name',
    example: 'Free',
  })
  planName: string;

  @ApiProperty({
    description: 'Features included in the plan',
    example: {
      clientManagement: true,
      manualAppointments: true,
      googleCalendarSync: true,
    },
  })
  features: {
    clientManagement: boolean;
    manualAppointments: boolean;
    googleCalendarSync: boolean;
  };

  @ApiProperty({
    description: 'Date when subscription was created',
    example: '2025-12-27T10:30:00.000Z',
  })
  createdAt: Date;
}

export class GetSubscriptionResponseDto {
  @ApiProperty({
    description: 'Success status',
    example: true,
  })
  success: boolean;

  @ApiProperty({
    description: 'Subscription details',
    type: SubscriptionDto,
  })
  subscription: SubscriptionDto;
}
