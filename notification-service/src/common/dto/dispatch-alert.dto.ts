import { IsArray, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class DispatchAlertDto {
    @IsString()
    @IsNotEmpty()
    eventId: string;

    @IsString()
    @IsNotEmpty()
    eventType: string;

    @IsString()
    @IsNotEmpty()
    severity: string;

    @IsString()
    @IsOptional()
    location?: string;

    @IsString()
    @IsNotEmpty()
    message: string;

    @IsArray()
    @IsOptional()
    responders?: string[];
}
