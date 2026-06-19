import { Type } from 'class-transformer';
import {
  IsString,
  IsEmail,
  IsNotEmpty,
  IsDateString,
  IsNumber,
  Min,
  IsEnum,
  IsIn,
  IsArray,
  IsOptional,
  ValidateIf,
} from 'class-validator';

export enum PaymentStatus {
  ALL = 'all',
  PAYMENT_LINK_NOT_GENERATED = 'payment_link_not_generated',
  OUTSTANDING = 'outstanding',
  PAID = 'paid',
  OVERDUE = 'overdue',
}

export enum DataOwner {
  ALL = 'all',
  OWNED_BY_ME = 'owned_by_me',
}

export class PaginatedRequest {
  @Type(() => Number)
  @IsNumber()
  page: number;

  @Type(() => Number)
  @IsNumber()
  limit: number;
}

export class PaginatedResult {
  @IsNumber()
  totalItems: number;

  @IsNumber()
  totalPages: number;
}

export class CreateInvoiceDto {
  @IsString()
  @IsNotEmpty({ message: 'Invoice number is required' })
  invoiceNumber: string;

  @IsString()
  @IsNotEmpty({ message: 'Customer name is required' })
  customerName: string;

  @IsEmail({}, { message: 'Customer email must be a valid email' })
  @IsNotEmpty({ message: 'Customer email is required' })
  customerEmail: string;

  @IsString()
  @IsNotEmpty({ message: 'Customer phone is required' })
  customerPhone: string;

  @IsDateString({}, { message: 'Invoice date must be a valid date string' })
  @IsNotEmpty({ message: 'Invoice date is required' })
  invoiceDate: string;

  @IsDateString({}, { message: 'Due date must be a valid date string' })
  @IsNotEmpty({ message: 'Due date is required' })
  dueDate: string;

  @Type(() => Number)
  @IsNumber({}, { message: 'Amount must be a number' })
  @Min(0, { message: 'Amount must be greater than zero' })
  amount: number;
}

export class FilterInvoiceDto extends PaginatedRequest {
  @IsOptional()
  @IsString()
  invoiceNumber?: string;

  @IsOptional()
  @IsString()
  customer?: string;

  @IsOptional()
  @ValidateIf((o) => o.invoiceDateStart !== '')
  @IsDateString({}, { message: 'Invoice date must be a valid date string' })
  invoiceDateStart?: string;

  @IsOptional()
  @ValidateIf((o) => o.invoiceDateEnd !== '')
  @IsDateString({}, { message: 'Invoice date must be a valid date string' })
  invoiceDateEnd?: string;

  @IsOptional()
  @ValidateIf((o) => o.dueDateStart !== '')
  @IsDateString({}, { message: 'Due date must be a valid date string' })
  dueDateStart?: string;

  @IsOptional()
  @ValidateIf((o) => o.dueDateEnd !== '')
  @IsDateString({}, { message: 'Due date must be a valid date string' })
  dueDateEnd?: string;

  @IsOptional()
  @IsEnum(PaymentStatus)
  paymentStatus?: PaymentStatus;

  @IsOptional()
  @IsEnum(DataOwner)
  dataOwner?: DataOwner;
}

export class DetailInvoiceDto {
  @IsString()
  @IsNotEmpty({ message: 'ID is required' })
  id: string;

  @IsString()
  @IsNotEmpty({ message: 'Invoice number is required' })
  invoiceNumber: string;

  @IsString()
  @IsNotEmpty({ message: 'Customer name is required' })
  customerName: string;

  @IsEmail({}, { message: 'Customer email must be a valid email' })
  @IsNotEmpty({ message: 'Customer email is required' })
  customerEmail: string;

  @IsString()
  @IsNotEmpty({ message: 'Customer phone is required' })
  customerPhone: string;

  @IsDateString({}, { message: 'Invoice date must be a valid date string' })
  @IsNotEmpty({ message: 'Invoice date is required' })
  invoiceDate: string;

  @IsDateString({}, { message: 'Due date must be a valid date string' })
  @IsNotEmpty({ message: 'Due date is required' })
  dueDate: string;

  @Type(() => Number)
  @IsNumber({}, { message: 'Amount must be a number' })
  @Min(0, { message: 'Amount must be greater than zero' })
  amount: number;

  @IsEnum(PaymentStatus)
  paymentStatus: PaymentStatus;
}

export class GetInvoiceByDto {
  @IsString()
  @IsIn(['id', 'invoice_number', 'payment_token'], {
    message: 'value must be one of id, invoice_number, payment_token',
  })
  filterBy: 'id' | 'invoice_number' | 'payment_token';

  @IsString()
  filterValue: string;
}

export class FilterInvoiceResultDto extends PaginatedResult {
  @IsArray()
  invoices: DetailInvoiceDto[];
}

export class GeneratePaymentLinkDto {
  @IsString()
  @IsNotEmpty({ message: 'Invoice ID is required' })
  invoiceId: string;
}

export class VerifyPaymentLinkDto {
  @IsString()
  @IsNotEmpty({ message: 'Payment token is required' })
  paymentToken: string;
}
