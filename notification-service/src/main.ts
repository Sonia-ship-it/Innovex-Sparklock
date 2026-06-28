import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Enable global validation
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

  // Enable CORS
  app.enableCors();

  // Connect Kafka microservice transport
  try {
    app.connectMicroservice<MicroserviceOptions>({
      transport: Transport.KAFKA,
      options: {
        client: {
          clientId: 'notification-service',
          brokers: (process.env.KAFKA_BROKERS || 'localhost:9092').split(','),
        },
        consumer: {
          groupId: 'notification-service-group',
        },
      },
    });

    await app.startAllMicroservices();
    console.log('[Kafka] Microservice transport connected');
  } catch (error) {
    console.warn('[Kafka] Failed to connect microservice transport:', error.message);
    console.warn('[Kafka] Notification service will run without Kafka consumer');
  }

  const port = process.env.PORT ?? 3002;
  await app.listen(port);
  console.log(`[Server] Notification service running on port ${port}`);
}

bootstrap();
