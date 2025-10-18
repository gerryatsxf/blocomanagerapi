import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  getHello(): string {
    return 'Hello World!';
  }

  getHealth(): string {
    return 'API is healthy and running!';
  }

  getDetailedHealth() {
    return {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      service: 'BlocoManager API',
      version: '1.0.0',
      environment: process.env.NODE_ENV || 'development',
      database: 'MongoDB Connected',
      uptime: process.uptime()
    };
  }
}
