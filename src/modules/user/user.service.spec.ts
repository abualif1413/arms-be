import { Test, TestingModule } from '@nestjs/testing';
import { UserService } from './user.service';
import { AppModule } from '../../app.module';
import { DataSource } from 'typeorm';

describe('UserService', () => {
  let app: TestingModule;
  let dataSource: DataSource;
  let service: UserService;

  beforeAll(async () => {
    app = await Test.createTestingModule({
      providers: [UserService],
      imports: [AppModule],
    }).compile();

    service = app.get<UserService>(UserService);
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
        "SELECT * FROM `users` WHERE email='test-finance-manager@mail.com'",
      );

      await dataSource.query(
        "DELETE FROM `users` WHERE email='test-finance-manager@mail.com'",
      );

      expect(inserted).toBeDefined();
      expect(register.id).toEqual(inserted.id);
      expect(register.name).toEqual(inserted.name);
      expect(register.email).toEqual(inserted.email);
      expect(register.password).toEqual(inserted.password);
    });

    it('should fail to register finance manager due to existing email"', async () => {
      await dataSource.query(
        "INSERT INTO `users` (id, name, email, password) VALUES ('some-id', 'Register Finance Manager Test', 'test-finance-manager@mail.com', '123');",
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
          "DELETE FROM `users` WHERE email='test-finance-manager@mail.com'",
        );
      }
    });
  });
});
