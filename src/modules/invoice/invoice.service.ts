import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { MailerService } from '@nestjs-modules/mailer';
import { DataSource } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import { UserEntity } from '../../entities/users';
import {
  CreateInvoiceDto,
  DataOwner,
  DetailInvoiceDto,
  FilterInvoiceDto,
  FilterInvoiceResultDto,
  GeneratePaymentLinkDto,
  PaymentStatus,
} from './invoice.dto';
import { InvoiceEntity } from '../../entities/invoices';
import { UserDecoratorDTO } from '../../decorators/user-decorator.dto';
import * as crypto from 'crypto';
import { PaidInvoiceEntity } from '../../entities/paid-invoices';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class InvoiceService {
  constructor(
    private readonly configService: ConfigService,
    private dataSource: DataSource,
    private jwtService: JwtService,
    private mailerService: MailerService,
  ) {}

  async createInvoice(
    createInvoiceDto: CreateInvoiceDto,
    user: UserDecoratorDTO,
  ): Promise<InvoiceEntity> {
    let newInvoiceEntity: InvoiceEntity = new InvoiceEntity();

    await this.dataSource.transaction(async (transactionalEntityManager) => {
      // Check if the user creating the invoice exists
      const financeManager = await transactionalEntityManager.findOne(
        UserEntity,
        {
          where: {
            id: user.id,
            email: user.email,
          },
        },
      );

      // Throw unauthorized error if the user creating the invoice does not exist
      if (!financeManager) {
        throw new HttpException(
          `The user creating the invoice does not exist.`,
          HttpStatus.UNAUTHORIZED,
        );
      }

      // Check if there's any invoices existing with the same invoice number
      const existingInvoice = await transactionalEntityManager.findOne(
        InvoiceEntity,
        {
          where: {
            invoiceNumber: createInvoiceDto.invoiceNumber,
          },
        },
      );

      // If there's any existing invoice with the same invoice number, throw conflict error
      if (existingInvoice) {
        throw new HttpException(
          `An invoice with the invoice number ${createInvoiceDto.invoiceNumber} already exists. Please use a different invoice number.`,
          HttpStatus.CONFLICT,
        );
      }

      const dtInvoiceDate = new Date(createInvoiceDto.invoiceDate);
      const dtDueDate = new Date(createInvoiceDto.dueDate);

      // Throw bad request error if due date is earlier than invoice date
      if (dtDueDate < dtInvoiceDate) {
        throw new HttpException(
          `Due date cannot be earlier than invoice date.`,
          HttpStatus.BAD_REQUEST,
        );
      }

      newInvoiceEntity = await transactionalEntityManager.save(InvoiceEntity, {
        invoiceNumber: createInvoiceDto.invoiceNumber,
        customerName: createInvoiceDto.customerName,
        customerEmail: createInvoiceDto.customerEmail,
        customerPhone: createInvoiceDto.customerPhone,
        invoiceDate: dtInvoiceDate,
        dueDate: dtDueDate,
        amount: createInvoiceDto.amount,
        financeManager: financeManager,
      });
    });

    return newInvoiceEntity;
  }

  async removeInvoice(
    invoiceId: string,
    user: UserDecoratorDTO,
  ): Promise<boolean> {
    await this.dataSource.transaction(async (transactionalEntityManager) => {
      // Check if the user creating the invoice exists
      const financeManager = await transactionalEntityManager.findOne(
        UserEntity,
        {
          where: {
            id: user.id,
            email: user.email,
          },
        },
      );

      // Throw unauthorized error if the user creating the invoice does not exist
      if (!financeManager) {
        throw new HttpException(
          `The user creating the invoice does not exist.`,
          HttpStatus.UNAUTHORIZED,
        );
      }

      // Get invoice data
      const invoice = await transactionalEntityManager.findOne(InvoiceEntity, {
        where: {
          id: invoiceId,
        },
      });

      if (!invoice) {
        throw new HttpException(`Invoice not found.`, HttpStatus.NOT_FOUND);
      }

      // Don't proceed if invoice has had payment link
      if (invoice?.paymentToken) {
        throw new HttpException(
          `Payment link for this invoice has been generated. Invoice can not be deleted.`,
          HttpStatus.BAD_REQUEST,
        );
      }

      // Remove if it's good to delete
      await transactionalEntityManager.remove(invoice);
    });

    return true;
  }

  getInvoicePaymentStatus(invoice: InvoiceEntity): PaymentStatus {
    const dueTime = new Date(invoice.dueDate).getTime();
    const thisTime = new Date().getTime();

    const isPaid = !!invoice.paidInvoice;
    if (isPaid) {
      return PaymentStatus.PAID;
    }
    if (!invoice.paymentToken) {
      return PaymentStatus.PAYMENT_LINK_NOT_GENERATED;
    }
    if (dueTime > thisTime && !isPaid && invoice.paymentToken) {
      return PaymentStatus.OUTSTANDING;
    }
    if (dueTime < thisTime && !isPaid) {
      return PaymentStatus.OVERDUE;
    }

    return PaymentStatus.ALL;
  }

  async filterInvoices(
    filterInvoiceDto: FilterInvoiceDto,
    user: UserDecoratorDTO,
  ): Promise<FilterInvoiceResultDto> {
    let invoiceList: FilterInvoiceResultDto = {
      totalItems: 0,
      totalPages: 0,
      invoices: [],
    };

    await this.dataSource.transaction(async (transactionalEntityManager) => {
      // Check if the user creating the invoice exists
      const financeManager = await transactionalEntityManager.findOne(
        UserEntity,
        {
          where: {
            id: user.id,
            email: user.email,
          },
        },
      );

      // Throw unauthorized error if the user creating the invoice does not exist
      if (!financeManager) {
        throw new HttpException(
          `The user creating the invoice does not exist.`,
          HttpStatus.UNAUTHORIZED,
        );
      }

      const queryBuilder = transactionalEntityManager.createQueryBuilder(
        InvoiceEntity,
        'invoice',
      );
      queryBuilder.leftJoinAndSelect('invoice.paidInvoice', 'paidInvoice');

      if (filterInvoiceDto.invoiceNumber) {
        queryBuilder.andWhere('invoice.invoice_number LIKE :invoiceNumber', {
          invoiceNumber: `%${filterInvoiceDto.invoiceNumber}%`,
        });
      }

      if (filterInvoiceDto.customer) {
        queryBuilder.andWhere(
          '(invoice.customer_name LIKE :customer OR invoice.customer_email LIKE :customer)',
          {
            customer: `%${filterInvoiceDto.customer}%`,
          },
        );
      }

      if (
        filterInvoiceDto.invoiceDateStart &&
        filterInvoiceDto.invoiceDateEnd
      ) {
        queryBuilder.andWhere(
          'invoice.invoice_date BETWEEN :invoiceDateStart AND :invoiceDateEnd',
          {
            invoiceDateStart: filterInvoiceDto.invoiceDateStart,
            invoiceDateEnd: filterInvoiceDto.invoiceDateEnd,
          },
        );
      }

      if (filterInvoiceDto.dueDateStart && filterInvoiceDto.dueDateEnd) {
        queryBuilder.andWhere(
          'invoice.due_date BETWEEN :dueDateStart AND :dueDateEnd',
          {
            dueDateStart: filterInvoiceDto.dueDateStart,
            dueDateEnd: filterInvoiceDto.dueDateEnd,
          },
        );
      }

      if (filterInvoiceDto.dataOwner === DataOwner.OWNED_BY_ME) {
        queryBuilder.andWhere('invoice.financeManagerId = :financeManagerId', {
          financeManagerId: user.id,
        });
      }

      if (
        filterInvoiceDto.paymentStatus &&
        filterInvoiceDto.paymentStatus !== PaymentStatus.ALL
      ) {
        switch (filterInvoiceDto.paymentStatus) {
          case PaymentStatus.OUTSTANDING:
            queryBuilder.andWhere(
              'invoice.due_date > NOW() AND invoice.payment_token IS NOT NULL AND paidInvoice.id IS NULL',
            );
            break;
          case PaymentStatus.PAYMENT_LINK_NOT_GENERATED:
            queryBuilder.andWhere('ISNULL(invoice.payment_token)');
            break;
          case PaymentStatus.OVERDUE:
            queryBuilder.andWhere(
              'invoice.due_date < NOW() AND invoice.payment_token IS NOT NULL AND paidInvoice.id IS NULL',
            );
            break;
          case PaymentStatus.PAID:
            queryBuilder.andWhere('paidInvoice.id IS NOT NULL');
            break;
          default:
            break;
        }
      }

      queryBuilder.orderBy('invoice.invoiceNumber', 'ASC');

      // Paginating result
      const skip = (filterInvoiceDto.page - 1) * filterInvoiceDto.limit;
      queryBuilder.skip(skip);
      queryBuilder.take(filterInvoiceDto.limit);
      const [invoices, totalItems] = await queryBuilder.getManyAndCount();
      const totalPages = Math.ceil(totalItems / filterInvoiceDto.limit);

      const allInvoices: DetailInvoiceDto[] = [];
      invoices.forEach((invoice) => {
        const detailInvoice: DetailInvoiceDto = {
          id: invoice.id,
          invoiceNumber: invoice.invoiceNumber,
          customerName: invoice.customerName,
          customerEmail: invoice.customerEmail,
          customerPhone: invoice.customerPhone,
          invoiceDate: invoice.invoiceDate.toString(),
          dueDate: invoice.dueDate.toString(),
          amount: invoice.amount,
          paymentStatus: this.getInvoicePaymentStatus(invoice),
        };

        allInvoices.push(detailInvoice);
      });

      invoiceList = {
        totalItems,
        totalPages,
        invoices: allInvoices,
      };
    });

    return invoiceList;
  }

  async getInvoiceByCriteria(
    filterBy: 'id' | 'invoice_number' | 'payment_token',
    filterValue: string,
    user: UserDecoratorDTO,
  ): Promise<DetailInvoiceDto> {
    let invoiceDetail: DetailInvoiceDto = new DetailInvoiceDto();

    await this.dataSource.transaction(async (transactionalEntityManager) => {
      // Check if the user creating the invoice exists
      const financeManager = await transactionalEntityManager.findOne(
        UserEntity,
        {
          where: {
            id: user.id,
            email: user.email,
          },
        },
      );

      // Throw unauthorized error if the user creating the invoice does not exist
      if (!financeManager) {
        throw new HttpException(
          `The user creating the invoice does not exist.`,
          HttpStatus.UNAUTHORIZED,
        );
      }

      let invoice: InvoiceEntity | null = null;
      switch (filterBy) {
        case 'id':
          invoice = await transactionalEntityManager.findOne(InvoiceEntity, {
            where: {
              id: filterValue,
            },
          });
          break;
        case 'invoice_number':
          invoice = await transactionalEntityManager.findOne(InvoiceEntity, {
            where: {
              invoiceNumber: filterValue,
            },
          });
          break;
        case 'payment_token':
          invoice = await transactionalEntityManager.findOne(InvoiceEntity, {
            where: {
              paymentToken: filterValue,
            },
          });
          break;

        default:
          break;
      }

      if (invoice) {
        invoiceDetail = {
          id: invoice.id,
          invoiceNumber: invoice.invoiceNumber,
          customerName: invoice.customerName,
          customerEmail: invoice.customerEmail,
          customerPhone: invoice.customerPhone,
          invoiceDate: invoice.invoiceDate.toString(),
          dueDate: invoice.dueDate.toString(),
          amount: invoice.amount,
          paymentStatus: this.getInvoicePaymentStatus(invoice),
        };
      } else {
        throw new HttpException(
          `The invoice you are looking for does not exist.`,
          HttpStatus.NOT_FOUND,
        );
      }
    });

    return invoiceDetail;
  }

  async generatePaymentLink(
    generatePaymentLinkDto: GeneratePaymentLinkDto,
    user: UserDecoratorDTO,
  ): Promise<boolean> {
    await this.dataSource.transaction(async (transactionalEntityManager) => {
      // Check if the user creating the invoice exists
      const financeManager = await transactionalEntityManager.findOne(
        UserEntity,
        {
          where: {
            id: user.id,
            email: user.email,
          },
        },
      );

      // Throw unauthorized error if the user creating the invoice does not exist
      if (!financeManager) {
        throw new HttpException(
          `The user does not exist.`,
          HttpStatus.UNAUTHORIZED,
        );
      }

      // Find the respective invoice data
      const invoice = await transactionalEntityManager.findOne(InvoiceEntity, {
        where: {
          id: generatePaymentLinkDto.invoiceId,
        },
      });

      if (!invoice) {
        throw new HttpException(
          `The invoice does not exist.`,
          HttpStatus.NOT_FOUND,
        );
      }

      // Generate 6 characters token
      const length = 6;
      const paymentShortToken = crypto
        .randomBytes(Math.ceil(length / 2))
        .toString('hex')
        .slice(0, length);

      // Generate payment token to sent to customer
      const paymentToken = await this.jwtService.signAsync(
        {
          id: invoice.id,
        },
        {
          expiresIn: '2d',
        },
      );

      // Update payment token in database
      invoice.paymentToken = paymentShortToken;
      await transactionalEntityManager.save(InvoiceEntity, invoice);

      // Send the payment link through email to the customer
      const htmlEmailContent = `
        <table
          role="presentation"
          style="width: 100%; border-collapse: collapse; background-color: #f9f9f9; padding: 20px;"
        >
          <tr>
            <td align="center">
              <table
                role="presentation"
                style="width: 600px; border-collapse: collapse; background-color: #ffffff; border-radius: 8px; overflow: hidden;"
              >
                <tr>
                  <td style="padding: 30px; text-align: left; color: #333333;">
                    <h2 style="margin-top: 0; color: #1f2937;">Dear ${invoice.customerName},</h2>
                    <p style="font-size: 16px; line-height: 1.6; margin-bottom: 20px;">
                      We have successfully generated a secure payment link for your invoice
                      <strong>#${invoice.invoiceNumber}</strong>.
                    </p>
                    <p style="font-size: 16px; line-height: 1.6; margin-bottom: 30px;">
                      Please click the button below to proceed with your payment. Use the
                      following security token when prompted:  
                      <strong>${paymentShortToken.toUpperCase()}</strong>
                    </p>

                    <p style="font-size: 16px; line-height: 1.6; margin-bottom: 30px; color: #b91c1c;">
                      This link will expire in <strong>2 days</strong>, so please be mindful to complete your payment promptly.
                    </p>
                    <div style="text-align: center; margin-bottom: 30px;">
                      <a
                        href="${this.configService.get<string>('ARMS_FE_BASE_URL')}/payment/${paymentToken}"
                        style="
                          background-color: #4f46e5;
                          color: #ffffff;
                          text-decoration: none;
                          padding: 12px 24px;
                          border-radius: 6px;
                          font-weight: bold;
                          display: inline-block;
                          font-size: 16px;
                        "
                      >
                        Proceed to Payment
                      </a>
                    </div>
                    <p style="font-size: 14px; color: #555555; line-height: 1.5;">
                      If you did not request this payment link, please ignore this email.
                      For any questions, contact our support team.
                    </p>
                    <p style="font-size: 14px; color: #555555; line-height: 1.5; margin-top: 20px;">
                      Thank you,<br />
                      <strong>Ilham Akbar - ARA - Technical Test</strong>
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      `;
      await this.mailerService.sendMail({
        from: 'Ilham Akbar - ARA - Technical Test <no-reply@somemail.com>',
        to: invoice.customerEmail,
        subject: `Your invoice #${invoice.invoiceNumber}`,
        html: htmlEmailContent,
      });
    });

    return true;
  }

  async verifyPaymentLink(paymentToken: string): Promise<InvoiceEntity> {
    let invoice = new InvoiceEntity();
    await this.dataSource.transaction(async (transactionalEntityManager) => {
      // Verify token
      let authenticationToken: {
        id: string;
      } = {
        id: '',
      };

      try {
        authenticationToken = (await this.jwtService.verify(paymentToken)) as {
          id: string;
        };
      } catch (error) {
        throw new HttpException(
          'The link seems to be invalid, incorrect, or somehow expired. No payment can be made with this link',
          HttpStatus.BAD_REQUEST,
        );
      }

      if (!authenticationToken) {
        throw new HttpException(
          'The link seems to be invalid, incorrect, or somehow expired. No payment can be made with this link',
          HttpStatus.BAD_REQUEST,
        );
      }

      // Verify if invoice exist
      const findInvoice = await transactionalEntityManager.findOne(
        InvoiceEntity,
        {
          where: {
            id: authenticationToken.id,
          },
          relations: {
            paidInvoice: true,
          },
        },
      );

      if (!findInvoice) {
        throw new HttpException(
          `The corresponding invoice associated with this payment link could not be found.`,
          HttpStatus.NOT_FOUND,
        );
      }

      // Don't let them proceed if has been paid
      if (findInvoice.paidInvoice) {
        throw new HttpException(
          `The corresponding invoice associated with this payment link has been paid. No payment can be made`,
          HttpStatus.BAD_REQUEST,
        );
      }

      invoice = findInvoice;
    });

    return invoice;
  }

  async proceedPayment(paymentToken: string): Promise<PaidInvoiceEntity> {
    let paidInvoice = new PaidInvoiceEntity();
    await this.dataSource.transaction(async (transactionalEntityManager) => {
      const invoice = await this.verifyPaymentLink(paymentToken);

      if (!invoice) {
        throw new HttpException(
          `The corresponding invoice associated with this payment link could not be found.`,
          HttpStatus.NOT_FOUND,
        );
      }

      paidInvoice.invoice = invoice;
      await transactionalEntityManager.save(paidInvoice);

      // Send the payment link through email to the customer
      const htmlEmailContent = `
        <table
          role="presentation"
          style="width: 100%; border-collapse: collapse; background-color: #f9f9f9; padding: 20px;"
        >
          <tr>
            <td align="center">
              <table
                role="presentation"
                style="width: 600px; border-collapse: collapse; background-color: #ffffff; border-radius: 8px; overflow: hidden;"
              >
                <tr>
                  <td style="padding: 30px; text-align: left; color: #333333;">
                    <h2 style="margin-top: 0; color: #1f2937;">Dear ${invoice.customerName},</h2>

                    <p style="font-size: 16px; line-height: 1.6; margin-bottom: 20px;">
                      We are pleased to inform you that your payment for invoice 
                      <strong>#${invoice.invoiceNumber}</strong> 
                      in the amount of <strong>$${invoice.amount}</strong> has been successfully processed.
                    </p>

                    <p style="font-size: 16px; line-height: 1.6; margin-bottom: 20px;">
                      You can now consider your invoice fully paid. A receipt has been generated for your records.
                    </p>

                    <p style="font-size: 16px; line-height: 1.6; margin-bottom: 30px; color: #047857;">
                      Thank you for your prompt payment. Your transaction has been securely completed.
                    </p>

                    <p style="font-size: 14px; color: #555555; line-height: 1.5;">
                      If you did not make this payment or have any questions, please contact our support team immediately.
                    </p>

                    <p style="font-size: 14px; color: #555555; line-height: 1.5; margin-top: 20px;">
                      Thank you,<br />
                      <strong>Ilham Akbar - ARA - Technical Test</strong>
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      `;

      // Send payment token to customer's email
      await this.mailerService.sendMail({
        from: 'Ilham Akbar - ARA - Technical Test <no-reply@somemail.com>',
        to: invoice.customerEmail,
        subject: `Your payment for invoice #${invoice.invoiceNumber}`,
        html: htmlEmailContent,
      });
    });

    return paidInvoice;
  }
}
