import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

export enum NotificationType {
    PUSH = 'push',
    SMS = 'sms',
    EMAIL = 'email',
}

export enum NotificationStatus {
    PENDING = 'pending',
    SENT = 'sent',
    FAILED = 'failed',
    RETRYING = 'retrying',
}

@Entity('notifications')
export class NotificationEntity {
    @PrimaryGeneratedColumn()
    id: number;

    @Column({ type: 'enum', enum: NotificationType })
    type: NotificationType;

    @Column()
    recipient: string;

    @Column({ nullable: true })
    subject: string;

    @Column('text')
    message: string;

    @Column({ type: 'enum', enum: NotificationStatus, default: NotificationStatus.PENDING })
    status: NotificationStatus;

    @Column({ name: 'event_id', nullable: true })
    eventId: string;

    @Column({ default: 0 })
    retries: number;

    @Column({ name: 'max_retries', default: 3 })
    maxRetries: number;

    @Column({ name: 'error_message', nullable: true })
    errorMessage: string;

    @CreateDateColumn({ name: 'sent_at' })
    sentAt: Date;

    @CreateDateColumn({ name: 'created_at' })
    createdAt: Date;
}
