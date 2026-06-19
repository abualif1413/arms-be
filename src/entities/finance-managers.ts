import {
  BeforeInsert,
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import * as bcrypt from 'bcrypt';
import { InvoiceEntity } from './invoices';

@Entity({ name: 'finance-managers' })
export class FinanceManagerEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ nullable: false })
  name: string;

  @Column({ nullable: false })
  email: string;

  @Column({ nullable: false })
  password: string;

  @Column({ nullable: false, name: 'security_question', default: '' })
  securityQuestion: string;

  @Column({ nullable: false, name: 'security_answer', default: '' })
  securityAnswer: string;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  @OneToMany(
    () => InvoiceEntity,
    (invoiceEntity) => invoiceEntity.financeManager,
    {
      cascade: ['insert', 'update'],
    },
  )
  invoices: InvoiceEntity[];

  @BeforeInsert()
  async hashPassword() {
    this.password = await bcrypt.hash(this.password, await bcrypt.genSalt());
  }
}
