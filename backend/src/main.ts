import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import { json, urlencoded } from 'express';

async function bootstrap() {
  const isProd = process.env.NODE_ENV === 'production';
  const app = await NestFactory.create(AppModule, {
    bufferLogs: isProd,
    logger: isProd ? ['error', 'warn'] : ['log', 'error', 'warn', 'debug', 'verbose'],
  });

  // Increase body limit for Base64 images
  app.use(json({ limit: '50mb' }));
  app.use(urlencoded({ extended: true, limit: '50mb' }));

  // Enable CORS
  app.enableCors({
    origin: true, // Allow all origins for now to fix connection issues on VPS
    credentials: true,
    methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    exposedHeaders: ['Content-Type'],
    maxAge: 600,
  });

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      disableErrorMessages: isProd,
    }),
  );

  // Global prefix
  app.setGlobalPrefix('api');

  const port = process.env.PORT || 3001;
  await app.listen(port,'0.0.0.0');

  const logger = new console.Console(process.stdout, process.stderr);
  logger.log(`🚀 Server running on http://localhost:${port}`);
  logger.log(`📚 API available at http://localhost:${port}/api`);
  logger.log(`🕒 Startup Time: ${new Date().toISOString()}`);
  logger.log(`📦 Backend Version Check: Ensure logs show this new message to confirm deployment.`);
}

void bootstrap();
