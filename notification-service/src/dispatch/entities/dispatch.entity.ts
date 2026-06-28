import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

export enum DispatchStatus {
    PENDING = 'pending',
    DISPATCHED = 'dispatched',
    ACKNOWLEDGED = 'acknowledged',
    RESOLVED = 'resolved',
}

@Entity('dispatches')
export class Dispatch {
    @PrimaryGeneratedColumn()
    id: number;

    @Column({ name: 'event_id' })
    eventId: string;

    @Column({ name: 'event_type' })
    eventType: string;

    @Column()
    severity: string;

    @Column({ nullable: true })
    location: string;

    @Column('text')
    message: string;

    @Column('simple-array', { nullable: true })
    responders: string[];

    @Column({ type: 'enum', enum: DispatchStatus, default: DispatchStatus.PENDING })
    status: DispatchStatus;

    @CreateDateColumn({ name: 'dispatched_at' })
    dispatchedAt: Date;
}
