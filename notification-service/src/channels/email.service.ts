import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class EmailService {
    private readonly logger = new Logger(EmailService.name);

    async sendEmail(
        to: string,
        subject: string,
        body: string,
    ): Promise<boolean> {
        const resendApiKey = process.env.RESEND_API_KEY;

        if (!resendApiKey) {
            this.logger.warn(
                `[STUB] Email → To: ${to}, Subject: "${subject}", Body: "${body}"`,
            );
            return true; // Simulate success in dev mode
        }

        try {
            // In production, call the Resend API
            const response = await fetch('https://api.resend.com/emails', {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${resendApiKey}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    from: process.env.RESEND_FROM || 'noreply@sparklock.dev',
                    to,
                    subject,
                    html: body,
                }),
            });

            if (!response.ok) {
                throw new Error(`Resend API error: ${response.statusText}`);
            }

            this.logger.log(`Email sent to ${to}`);
            return true;
        } catch (error) {
            this.logger.error(`Email failed: ${error.message}`);
            return false;
        }
    }
}
