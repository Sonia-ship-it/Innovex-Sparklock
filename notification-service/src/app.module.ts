import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { NotificationModule } from './notification/notification.module';
import { DispatchModule } from './dispatch/dispatch.module';
import { KafkaConsumerController } from './kafka/kafka.consumer';
import { NotificationEntity } from './notification/entities/notification.entity';
import { Dispatch } from './dispatch/entities/dispatch.entity';

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT as string, 10) || 5432,
      username: process.env.DB_USER || 'sparklock',
      password: process.env.DB_PASSWORD || 'sparklock_secret',
      database: process.env.DB_NAME || 'sparklock_notification',
      entities: [NotificationEntity, Dispatch],
      synchronize: true, // Dev only — use migrations in production
    }),
    NotificationModule,
    DispatchModule,
  ],
  controllers: [KafkaConsumerController],
  providers: [],
})
export class AppModule { }
