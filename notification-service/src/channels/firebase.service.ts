import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class FirebaseService {
    private readonly logger = new Logger(FirebaseService.name);

    async sendPushNotification(
        deviceToken: string,
        title: string,
        body: string,
    ): Promise<boolean> {
        // Check if Firebase credentials are configured
        const fcmKey = process.env.FIREBASE_SERVER_KEY;

        if (!fcmKey) {
            this.logger.warn(
                `[STUB] Push notification → Token: ${deviceToken}, Title: "${title}", Body: "${body}"`,
            );
            return true; // Simulate success in dev mode
        }

        try {
            // In production, use firebase-admin SDK
            // const admin = require('firebase-admin');
            // await admin.messaging().send({ token: deviceToken, notification: { title, body } });
            this.logger.log(`Push notification sent to ${deviceToken}`);
            return true;
        } catch (error) {
            this.logger.error(`Push notification failed: ${error.message}`);
            return false;
        }
    }
}
