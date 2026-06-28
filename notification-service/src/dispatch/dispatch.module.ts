import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Dispatch } from './entities/dispatch.entity';
import { DispatchService } from './dispatch.service';
import { DispatchController } from './dispatch.controller';
import { NotificationModule } from '../notification/notification.module';

@Module({
    imports: [TypeOrmModule.forFeature([Dispatch]), NotificationModule],
    controllers: [DispatchController],
    providers: [DispatchService],
    exports: [DispatchService],
})
export class DispatchModule { }
