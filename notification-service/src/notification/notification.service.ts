import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
    NotificationEntity,
    NotificationStatus,
    NotificationType,
} from './entities/notification.entity';
import { SendNotificationDto } from '../common/dto/send-notification.dto';
import { FirebaseService } from '../channels/firebase.service';
import { TwilioService } from '../channels/twilio.service';
import { EmailService } from '../channels/email.service';

@Injectable()
export class NotificationService {
    private readonly logger = new Logger(NotificationService.name);

    constructor(
        @InjectRepository(NotificationEntity)
        private readonly notificationRepo: Repository<NotificationEntity>,
        private readonly firebaseService: FirebaseService,
        private readonly twilioService: TwilioService,
        private readonly emailService: EmailService,
    ) { }

    async send(dto: SendNotificationDto): Promise<NotificationEntity> {
        // Create notification record
        const notification = this.notificationRepo.create({
            type: dto.type,
            recipient: dto.recipient,
            subject: dto.subject,
            message: dto.message,
            eventId: dto.eventId,
            status: NotificationStatus.PENDING,
        });

        await this.notificationRepo.save(notification);

        // Attempt to send through the appropriate channel
        await this.dispatch(notification);

        return notification;
    }

    private async dispatch(notification: NotificationEntity): Promise<void> {
        let success = false;

        try {
            switch (notification.type) {
                case NotificationType.PUSH:
                    success = await this.firebaseService.sendPushNotification(
                        notification.recipient,
                        notification.subject || 'Sparklock Alert',
                        notification.message,
                    );
                    break;

                case NotificationType.SMS:
                    success = await this.twilioService.sendSms(
                        notification.recipient,
                        notification.message,
                    );
                    break;

                case NotificationType.EMAIL:
                    success = await this.emailService.sendEmail(
                        notification.recipient,
                        notification.subject || 'Sparklock Alert',
                        notification.message,
                    );
                    break;
            }

            if (success) {
                notification.status = NotificationStatus.SENT;
                this.logger.log(
                    `Notification ${notification.id} sent via ${notification.type} to ${notification.recipient}`,
                );
            } else {
                throw new Error('Channel returned failure');
            }
        } catch (error) {
            notification.retries += 1;
            notification.errorMessage = error.message;

            if (notification.retries < notification.maxRetries) {
                notification.status = NotificationStatus.RETRYING;
                this.logger.warn(
                    `Notification ${notification.id} failed (attempt ${notification.retries}/${notification.maxRetries}): ${error.message}`,
                );

                // Schedule retry with exponential backoff
                const delayMs = Math.pow(2, notification.retries) * 1000;
                setTimeout(() => this.dispatch(notification), delayMs);
            } else {
                notification.status = NotificationStatus.FAILED;
                this.logger.error(
                    `Notification ${notification.id} permanently failed after ${notification.maxRetries} retries`,
                );
            }
        }

        await this.notificationRepo.save(notification);
    }

    async getStatus(id: number): Promise<NotificationEntity | null> {
        const notification = await this.notificationRepo.findOne({
            where: { id },
        });

        if (!notification) {
            return null;
        }

        return notification;
    }

    async findAll(): Promise<NotificationEntity[]> {
        return this.notificationRepo.find({
            order: { createdAt: 'DESC' },
            take: 100,
        });
    }
}
