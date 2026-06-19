import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToOne,
} from 'typeorm';
import { FinanceManagerEntity } from './finance-managers';
import { PaidInvoiceEntity } from './paid-invoices';

@Entity({ name: 'invoices' })
export class InvoiceEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({
    name: 'invoice_number',
    type: 'varchar',
    length: 10,
    unique: true,
  })
  invoiceNumber: string;

  @Column({ name: 'customer_name', type: 'varchar' })
  customerName: string;

  @Column({ name: 'customer_email', type: 'varchar' })
  customerEmail: string;

  @Column({ name: 'customer_phone', type: 'varchar' })
  customerPhone: string;

  @Column({ name: 'invoice_date', type: 'timestamp' })
  invoiceDate: Date;

  @Column({ name: 'due_date', type: 'timestamp' })
  dueDate: Date;

  @Column({ name: 'amount', type: 'decimal', precision: 10, scale: 2 })
  amount: number;

  @Column({ name: 'payment_token', type: 'varchar', nullable: true })
  paymentToken: string | null;

  // Timestamps
  @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamp' })
  updatedAt: Date;

  @ManyToOne(
    () => FinanceManagerEntity,
    (FinanceManagerEntity) => FinanceManagerEntity.invoices,
    {
      cascade: ['insert', 'update'],
    },
  )
  financeManager: FinanceManagerEntity;

  @OneToOne(
    () => PaidInvoiceEntity,
    (PaidInvoiceEntity) => PaidInvoiceEntity.invoice,
    {
      cascade: ['insert', 'update'],
    },
  )
  paidInvoice: PaidInvoiceEntity;
}
