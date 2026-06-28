import {
    Body,
    Controller,
    Get,
    Param,
    ParseIntPipe,
    Post,
} from '@nestjs/common';
import { NotificationService } from './notification.service';
import { SendNotificationDto } from '../common/dto/send-notification.dto';

@Controller('notify')
export class NotificationController {
    constructor(private readonly notificationService: NotificationService) { }

    @Post('send')
    async send(@Body() dto: SendNotificationDto) {
        const notification = await this.notificationService.send(dto);
        return {
            success: true,
            data: notification,
        };
    }

    @Get('status/:id')
    async getStatus(@Param('id', ParseIntPipe) id: number) {
        const notification = await this.notificationService.getStatus(id);

        if (!notification) {
            return {
                success: false,
                message: `Notification ${id} not found`,
            };
        }

        return {
            success: true,
            data: notification,
        };
    }
}
