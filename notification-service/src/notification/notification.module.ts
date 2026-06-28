import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { NotificationEntity } from './entities/notification.entity';
import { NotificationService } from './notification.service';
import { NotificationController } from './notification.controller';
import { FirebaseService } from '../channels/firebase.service';
import { TwilioService } from '../channels/twilio.service';
import { EmailService } from '../channels/email.service';

@Module({
    imports: [TypeOrmModule.forFeature([NotificationEntity])],
    controllers: [NotificationController],
    providers: [
        NotificationService,
        FirebaseService,
        TwilioService,
        EmailService,
    ],
    exports: [NotificationService],
})
export class NotificationModule { }
