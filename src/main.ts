import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { NestExpressApplication } from '@nestjs/platform-express';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { join } from 'path';
import * as fs from 'fs';
import * as dotenv from 'dotenv';
import * as path from 'path';
import { ConfigService } from '@nestjs/config';

// Only load .env file if not running in Docker
if (!process.env.DOCKER_ENV) {
  dotenv.config({ path: path.resolve(process.cwd(), 'env/dev.env') });
}

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    rawBody: true,
  });

  // Enable CORS with permissive settings
  app.enableCors({
    origin: true,
    credentials: true,
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    allowedHeaders: '*',
  });

  // Get ConfigService for VPN IP checking
  const configService = app.get(ConfigService);

  // Serve static files for admin panel
  app.useStaticAssets(join(__dirname, '..', 'public'), {
    prefix: '/public/',
  });

  // Serve static files for tenant assets (images, etc.)
  app.useStaticAssets(join(__dirname, '..', 'public', 'tenant', 'assets'), {
    prefix: '/tenant/assets/',
  });

  // Clean URL routes for admin panels
  const expressApp = app.getHttpAdapter().getInstance();
  expressApp.get('/tenant/admin', (req, res) => {
    res.sendFile(join(__dirname, '..', 'public', 'tenant', 'index.html'));
  });
  expressApp.get('/admin/panel', (req, res) => {
    res.sendFile(join(__dirname, '..', 'public', 'admin', 'index.html'));
  });

  const config = new DocumentBuilder()
    .setTitle('BlocoManager API')
    .setDescription('Welcome to the BlocoManager API reference.')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config);
  fs.writeFileSync('./swagger-spec.json', JSON.stringify(document));

  // Setup Swagger with VPN IP restriction
  SwaggerModule.setup('swagger', app, document, {
    swaggerOptions: {
      persistAuthorization: true,
    },
    customSiteTitle: 'BlocoManager API Docs',
    // Add middleware to check VPN IP before allowing access
    customJsStr: `
      // VPN check is handled by Express middleware
    `,
  });

  // Middleware to protect Swagger endpoints
  app.use('/swagger', (req, res, next) => {
    const allowedIps = configService.get<string>('VPN_ALLOWED_IPS', '').split(',').map(ip => ip.trim()).filter(ip => ip.length > 0);
    
    if (allowedIps.length === 0) {
      console.warn('⚠️  VPN_ALLOWED_IPS not configured for Swagger - allowing all IPs (DEVELOPMENT MODE)');
      return next();
    }

    const clientIp = req.headers['x-forwarded-for']?.toString().split(',')[0]?.trim() 
      || req.headers['x-real-ip']?.toString()
      || req.ip 
      || req.socket.remoteAddress 
      || 'unknown';

    console.log('Swagger access attempt from IP:', clientIp);

    if (allowedIps.includes(clientIp)) {
      return next();
    }

    res.status(403).json({
      statusCode: 403,
      message: `Access denied. Swagger is only accessible via VPN. Your IP: ${clientIp}`,
    });
  });

  // Protect swagger-spec.json endpoint
  app.use('/swagger-json', (req, res, next) => {
    const allowedIps = configService.get<string>('VPN_ALLOWED_IPS', '').split(',').map(ip => ip.trim()).filter(ip => ip.length > 0);
    
    if (allowedIps.length === 0) {
      console.warn('⚠️  VPN_ALLOWED_IPS not configured for Swagger JSON - allowing all IPs (DEVELOPMENT MODE)');
      return next();
    }

    const clientIp = req.headers['x-forwarded-for']?.toString().split(',')[0]?.trim()
      || req.headers['x-real-ip']?.toString()
      || req.ip
      || req.socket.remoteAddress
      || 'unknown';

    console.log('Swagger JSON access attempt from IP:', clientIp);

    if (allowedIps.includes(clientIp)) {
      return next();
    }

    res.status(403).json({
      statusCode: 403,
      message: `Access denied. Swagger JSON is only accessible via VPN. Your IP: ${clientIp}`,
    });
  });

  await app.listen(3002);
  console.log(`Application is running on: ${await app.getUrl()}`);
  console.log(`Admin panel available at: ${await app.getUrl()}/admin/panel`);
  console.log(`Tenant panel available at: ${await app.getUrl()}/tenant/admin`);
}
bootstrap();
