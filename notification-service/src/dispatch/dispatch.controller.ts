import { Body, Controller, Get, Param, ParseIntPipe, Post } from '@nestjs/common';
import { DispatchService } from './dispatch.service';
import { DispatchAlertDto } from '../common/dto/dispatch-alert.dto';

@Controller('notify')
export class DispatchController {
    constructor(private readonly dispatchService: DispatchService) { }

    @Post('dispatch')
    async dispatch(@Body() dto: DispatchAlertDto) {
        const result = await this.dispatchService.dispatchAlert(dto);
        return {
            success: true,
            data: result,
        };
    }

    @Get('dispatches')
    async findAll() {
        const dispatches = await this.dispatchService.findAll();
        return {
            success: true,
            count: dispatches.length,
            data: dispatches,
        };
    }

    @Get('dispatches/:id')
    async getOne(@Param('id', ParseIntPipe) id: number) {
        const dispatch = await this.dispatchService.getDispatch(id);
        if (!dispatch) {
            return { success: false, message: `Dispatch ${id} not found` };
        }
        return { success: true, data: dispatch };
    }
}
