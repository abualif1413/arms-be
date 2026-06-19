import { Test, TestingModule } from '@nestjs/testing';
import { AppModule } from '../../app.module';
import { DataSource } from 'typeorm';
import { FinanceManagerEntity } from '../../entities/finance-managers';
import { JwtService } from '@nestjs/jwt';
import { InvoiceService } from './invoice.service';
import { InvoiceEntity } from '../../entities/invoices';

describe('InvoiceService', () => {
  let app: TestingModule;
  let dataSource: DataSource;
  let service: InvoiceService;
  let jwtService: jest.Mocked<JwtService>;
  let financeManagerEntity: FinanceManagerEntity;

  beforeAll(async () => {
    app = await Test.createTestingModule({
      providers: [
        InvoiceService,
        {
          provide: JwtService, // Provide a mock for JwtService
          useValue: {},
        },
      ],
      imports: [AppModule],
    }).compile();

    service = app.get<InvoiceService>(InvoiceService);
    dataSource = app.get<DataSource>(DataSource);
    jwtService = app.get(JwtService);

    const financeManager = new FinanceManagerEntity();
    financeManager.name = 'Finance Manager Test';
    financeManager.email = 'finance.manager.test@mail';
    financeManager.password = '12345';
    financeManager.securityQuestion = '';
    financeManager.securityAnswer = '';
    financeManagerEntity = await dataSource
      .createEntityManager()
      .save(financeManager);
  });

  afterAll(async () => {
    await dataSource.createEntityManager().remove(financeManagerEntity);
    await dataSource.destroy();
    await app.close();
  });

  describe('createInvoice', () => {
    it('should successfully creating invoice', async () => {
      const invoiceResult = await service.createInvoice(
        {
          amount: 3000,
          customerName: 'some customer name',
          customerEmail: 'some.customer.email@mail',
          customerPhone: '',
          dueDate: '2025-12-01',
          invoiceDate: '2025-11-15',
          invoiceNumber: 'inv-tst',
        },
        {
          email: financeManagerEntity.email,
          name: financeManagerEntity.name,
          id: financeManagerEntity.id,
        },
      );
      expect(invoiceResult).toBeDefined();

      // Remove invoice data to avoid any problem
      await dataSource.query(
        "DELETE FROM `invoices` WHERE id='" + invoiceResult.id + "'",
      );
    });

    it('should fail creating due to invoice number already exist', async () => {
      await dataSource.query(`
        INSERT INTO \`invoices\` (
          id,
          invoice_number,
          customer_name,
          customer_email,
          customer_phone,
          invoice_date,
          due_date,
          amount
        ) VALUES (
          'some-new-id',
          'inv-number',
          'customer-name',
          'customer-email',
          '',
          '2025-11-25',
          '2025-12-01',
          '5000'
        )
      `);

      try {
        await service.createInvoice(
          {
            amount: 3000,
            customerName: 'some customer name',
            customerEmail: 'some.customer.email@mail',
            customerPhone: '',
            dueDate: '2025-12-01',
            invoiceDate: '2025-11-15',
            invoiceNumber: 'inv-number',
          },
          {
            email: financeManagerEntity.email,
            name: financeManagerEntity.name,
            id: financeManagerEntity.id,
          },
        );
      } catch (error) {
        expect(error.message).toBe(
          'An invoice with the invoice number inv-number already exists. Please use a different invoice number.',
        );
      } finally {
        // Remove invoice data to avoid any problem
        await dataSource.query("DELETE FROM `invoices` WHERE id='some-new-id'");
      }
    });
  });
});
