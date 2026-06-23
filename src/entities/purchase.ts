import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { FlashSaleEntity } from './flash-sales';
import { UserEntity } from './users';

export enum PurchaseStatus {
  PROCESSING = 'processing',
  DONE = 'done',
  FAILED = 'failed',
}

@Entity({ name: 'purchases' })
export class PurchaseEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({
    type: 'enum',
    enum: PurchaseStatus,
    nullable: true,
  })
  status: PurchaseStatus;

  @Column({ type: 'varchar', nullable: true })
  message: string | null;

  @Column({ name: 'purchase_code', type: 'varchar', nullable: true })
  purchaseCode: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamp' })
  updatedAt: Date;

  @ManyToOne(() => FlashSaleEntity)
  @JoinColumn({ name: 'flash_sale_id' })
  flashSale: FlashSaleEntity;

  @ManyToOne(() => UserEntity)
  @JoinColumn({ name: 'user_id' })
  user: UserEntity;
}
