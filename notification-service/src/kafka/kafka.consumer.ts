import { Controller, Logger } from '@nestjs/common';
import { EventPattern, Payload } from '@nestjs/microservices';
import { NotificationService } from '../notification/notification.service';
import { DispatchService } from '../dispatch/dispatch.service';
import { NotificationType } from '../notification/entities/notification.entity';

@Controller()
export class KafkaConsumerController {
    private readonly logger = new Logger(KafkaConsumerController.name);

    constructor(
        private readonly notificationService: NotificationService,
        private readonly dispatchService: DispatchService,
    ) { }

    @EventPattern('hazard-events')
    async handleHazardEvent(@Payload() message: any) {
        this.logger.log(`Received hazard event: ${JSON.stringify(message)}`);

        try {
            const event = typeof message === 'string' ? JSON.parse(message) : message;

            // 1. Create an emergency dispatch
            await this.dispatchService.dispatchAlert({
                eventId: `hazard-${Date.now()}`,
                eventType: event.type || 'unknown_hazard',
                severity: event.severity || 'WARNING',
                location: event.location || 'unknown',
                message:
                    event.message ||
                    `Hazard detected: ${event.type} at ${event.location}`,
                responders: [], // In production, fetch from user service
            });

            // 2. Send a general notification (email to admin)
            await this.notificationService.send({
                type: NotificationType.EMAIL,
                recipient: process.env.ADMIN_EMAIL || 'admin@sparklock.dev',
                subject: `🚨 Sparklock Alert: ${event.type}`,
                message: `
          <h2>Hazard Detected</h2>
          <p><strong>Type:</strong> ${event.type}</p>
          <p><strong>Severity:</strong> ${event.severity}</p>
          <p><strong>Location:</strong> ${event.location}</p>
          <p><strong>Sensor:</strong> ${event.sensorId}</p>
          <p><strong>Value:</strong> ${event.value}${event.unit || ''}</p>
          <p><strong>Time:</strong> ${event.detectedAt || new Date().toISOString()}</p>
          <p>${event.message || ''}</p>
        `,
                eventId: event.sensorId,
            });

            this.logger.log(`Hazard event processed successfully: ${event.type}`);
        } catch (error) {
            this.logger.error(`Failed to process hazard event: ${error.message}`);
        }
    }
}
