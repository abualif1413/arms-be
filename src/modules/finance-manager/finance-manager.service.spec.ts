import { Test, TestingModule } from '@nestjs/testing';
import { FinanceManagerService } from './finance-manager.service';
import { AppModule } from '../../app.module';
import { DataSource } from 'typeorm';

describe('FinanceManagerService', () => {
  let app: TestingModule;
  let dataSource: DataSource;
  let service: FinanceManagerService;

  beforeAll(async () => {
    app = await Test.createTestingModule({
      providers: [FinanceManagerService],
      imports: [AppModule],
    }).compile();

    service = app.get<FinanceManagerService>(FinanceManagerService);
    dataSource = app.get<DataSource>(DataSource);
  });

  afterAll(async () => {
    await dataSource.destroy();
    await app.close();
  });

  describe('register', () => {
    it('should successfully register finance manager"', async () => {
      const register = await service.register({
        name: 'Register Finance Manager Test',
        email: 'test-finance-manager@mail.com',
        password: '12345',
        securityQuestion: '',
        securityAnswer: '',
      });

      const [inserted] = await dataSource.query(
        "SELECT * FROM `finance-managers` WHERE email='test-finance-manager@mail.com'",
      );

      await dataSource.query(
        "DELETE FROM `finance-managers` WHERE email='test-finance-manager@mail.com'",
      );

      expect(inserted).toBeDefined();
      expect(register.id).toEqual(inserted.id);
      expect(register.name).toEqual(inserted.name);
      expect(register.email).toEqual(inserted.email);
      expect(register.password).toEqual(inserted.password);
    });

    it('should fail to register finance manager due to existing email"', async () => {
      await dataSource.query(
        "INSERT INTO `finance-managers` (id, name, email, password) VALUES ('some-id', 'Register Finance Manager Test', 'test-finance-manager@mail.com', '123');",
      );

      try {
        await service.register({
          name: 'Register Finance Manager Test',
          email: 'test-finance-manager@mail.com',
          password: '12345',
          securityQuestion: '',
          securityAnswer: '',
        });
      } catch (error) {
        expect(error.message).toBe(
          'The email address test-finance-manager@mail.com is already registered. Please use a different email address',
        );
      } finally {
        await dataSource.query(
          "DELETE FROM `finance-managers` WHERE email='test-finance-manager@mail.com'",
        );
      }
    });
  });
});
