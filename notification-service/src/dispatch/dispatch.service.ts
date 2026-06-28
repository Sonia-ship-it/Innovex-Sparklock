import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Dispatch, DispatchStatus } from './entities/dispatch.entity';
import { DispatchAlertDto } from '../common/dto/dispatch-alert.dto';
import { NotificationService } from '../notification/notification.service';
import { NotificationType } from '../notification/entities/notification.entity';

@Injectable()
export class DispatchService {
    private readonly logger = new Logger(DispatchService.name);

    constructor(
        @InjectRepository(Dispatch)
        private readonly dispatchRepo: Repository<Dispatch>,
        private readonly notificationService: NotificationService,
    ) { }

    async dispatchAlert(dto: DispatchAlertDto): Promise<Dispatch> {
        // Create dispatch record
        const dispatch = this.dispatchRepo.create({
            eventId: dto.eventId,
            eventType: dto.eventType,
            severity: dto.severity,
            location: dto.location,
            message: dto.message,
            responders: dto.responders || [],
            status: DispatchStatus.DISPATCHED,
        });

        await this.dispatchRepo.save(dispatch);

        // Send notifications to all responders
        if (dispatch.responders && dispatch.responders.length > 0) {
            for (const responder of dispatch.responders) {
                try {
                    await this.notificationService.send({
                        type: NotificationType.PUSH,
                        recipient: responder,
                        subject: `🚨 ${dto.severity} ALERT: ${dto.eventType}`,
                        message: dto.message,
                        eventId: dto.eventId,
                    });
                } catch (error) {
                    this.logger.error(
                        `Failed to notify responder ${responder}: ${error.message}`,
                    );
                }
            }
        }

        this.logger.log(
            `Emergency dispatched: ${dto.eventType} (${dto.severity}) → ${dispatch.responders?.length || 0} responders`,
        );

        return dispatch;
    }

    async getDispatch(id: number): Promise<Dispatch | null> {
        return this.dispatchRepo.findOne({ where: { id } });
    }

    async findAll(): Promise<Dispatch[]> {
        return this.dispatchRepo.find({
            order: { dispatchedAt: 'DESC' },
            take: 100,
        });
    }
}
