import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToOne,
  JoinColumn,
} from 'typeorm';
import { UserEntity } from './users';
import { InvoiceEntity } from './invoices';

@Entity({ name: 'paid-invoices' })
export class PaidInvoiceEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // Timestamps
  @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamp' })
  updatedAt: Date;

  @OneToOne(() => InvoiceEntity, (InvoiceEntity) => InvoiceEntity.paidInvoice, {
    cascade: ['insert', 'update'],
  })
  @JoinColumn()
  invoice: InvoiceEntity;
}
