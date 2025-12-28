import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { NestExpressApplication } from '@nestjs/platform-express';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { join } from 'path';
import * as fs from 'fs';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Only load .env file if not running in Docker
if (!process.env.DOCKER_ENV) {
  dotenv.config({ path: path.resolve(process.cwd(), 'env/dev.env') });
}

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    rawBody: true,
    cors: true,
  });

  // Serve static files for admin panel
  app.useStaticAssets(join(__dirname, '..', 'public'), {
    prefix: '/public/',
  });

  const config = new DocumentBuilder()
    .setTitle('BlocoManager API')
    .setDescription('Welcome to the BlocoManager API reference.')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config);
  fs.writeFileSync('./swagger-spec.json', JSON.stringify(document));
  SwaggerModule.setup('swagger', app, document);

  await app.listen(3002);
  console.log(`Application is running on: ${await app.getUrl()}`);
  console.log(`Admin panel available at: ${await app.getUrl()}/public/admin/index.html`);
}
bootstrap();
