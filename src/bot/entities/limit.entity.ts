import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

export enum PeriodType {
  DAILY = 'daily',
  WEEKLY = 'weekly',
  MONTHLY = 'monthly',
}

@Entity()
export class Limit {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  user_id: number;

  @Column()
  amount: number;

  @Column({
    type: 'enum',
    enum: PeriodType,
    default: PeriodType.DAILY,
  })
  period: PeriodType;

  @Column({ default: false })
  notified: boolean;
}
