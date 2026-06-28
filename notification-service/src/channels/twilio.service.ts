import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class TwilioService {
    private readonly logger = new Logger(TwilioService.name);

    async sendSms(to: string, message: string): Promise<boolean> {
        const accountSid = process.env.TWILIO_ACCOUNT_SID;
        const authToken = process.env.TWILIO_AUTH_TOKEN;
        const fromNumber = process.env.TWILIO_PHONE_NUMBER;

        if (!accountSid || !authToken || !fromNumber) {
            this.logger.warn(
                `[STUB] SMS → To: ${to}, Message: "${message}"`,
            );
            return true; // Simulate success in dev mode
        }

        try {
            const twilio = require('twilio')(accountSid, authToken);
            await twilio.messages.create({
                body: message,
                from: fromNumber,
                to,
            });
            this.logger.log(`SMS sent to ${to}`);
            return true;
        } catch (error) {
            this.logger.error(`SMS failed: ${error.message}`);
            return false;
        }
    }
}
