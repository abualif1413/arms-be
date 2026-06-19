import {
  Body,
  Controller,
  Delete,
  Get,
  HttpException,
  HttpStatus,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { InvoiceService } from './invoice.service';
import {
  CreateInvoiceDto,
  DetailInvoiceDto,
  FilterInvoiceDto,
  FilterInvoiceResultDto,
  GeneratePaymentLinkDto,
  GetInvoiceByDto,
  VerifyPaymentLinkDto,
} from './invoice.dto';
import { User } from '../../decorators/user';
import { UserDecoratorDTO } from '../../decorators/user-decorator.dto';
import { InvoiceEntity } from '../../entities/invoices';
import { PaidInvoiceEntity } from '../../entities/paid-invoices';

@Controller('invoices')
export class InvoiceController {
  constructor(private invoiceService: InvoiceService) {}

  @Post('create')
  async create(
    @Body() createInvoiceDto: CreateInvoiceDto,
    @User() user: UserDecoratorDTO,
  ): Promise<InvoiceEntity> {
    if (!user) {
      throw new HttpException(`Unauthorized user.`, HttpStatus.UNAUTHORIZED);
    }

    return this.invoiceService.createInvoice(createInvoiceDto, user);
  }

  @Delete('remove/:invoice_id')
  async remove(
    @Param('invoice_id') invoiceId: string,
    @User() user: UserDecoratorDTO,
  ): Promise<boolean> {
    if (!user) {
      throw new HttpException(`Unauthorized user.`, HttpStatus.UNAUTHORIZED);
    }

    return this.invoiceService.removeInvoice(invoiceId, user);
  }

  @Get('filter')
  async filter(
    @Query() filterInvoiceDto: FilterInvoiceDto,
    @User() user: UserDecoratorDTO,
  ): Promise<FilterInvoiceResultDto> {
    if (!user) {
      throw new HttpException(`Unauthorized user.`, HttpStatus.UNAUTHORIZED);
    }

    return this.invoiceService.filterInvoices(filterInvoiceDto, user);
  }

  @Get('get-by')
  async getBy(
    @Query() GetInvoiceByDto: GetInvoiceByDto,
    @User() user: UserDecoratorDTO,
  ): Promise<DetailInvoiceDto> {
    if (!user) {
      throw new HttpException(`Unauthorized user.`, HttpStatus.UNAUTHORIZED);
    }

    return this.invoiceService.getInvoiceByCriteria(
      GetInvoiceByDto.filterBy,
      GetInvoiceByDto.filterValue,
      user,
    );
  }

  @Post('generate-payment-link')
  async GeneratePaymentLinkDto(
    @Body() generatePaymentLinkDto: GeneratePaymentLinkDto,
    @User() user: UserDecoratorDTO,
  ): Promise<boolean> {
    if (!user) {
      throw new HttpException(`Unauthorized user.`, HttpStatus.UNAUTHORIZED);
    }

    return this.invoiceService.generatePaymentLink(
      generatePaymentLinkDto,
      user,
    );
  }

  @Get('verify-payment-link')
  async VerifyPaymentLinkDto(
    @Query() verifyPaymentLinkDto: VerifyPaymentLinkDto,
  ): Promise<InvoiceEntity> {
    return this.invoiceService.verifyPaymentLink(
      verifyPaymentLinkDto.paymentToken,
    );
  }

  @Post('proceed-payment')
  async proceedPayment(
    @Body() verifyPaymentLinkDto: VerifyPaymentLinkDto,
  ): Promise<PaidInvoiceEntity> {
    return this.invoiceService.proceedPayment(
      verifyPaymentLinkDto.paymentToken,
    );
  }
}
