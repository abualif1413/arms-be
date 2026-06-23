import { Test, TestingModule } from '@nestjs/testing';
import { AppModule } from '../../app.module';
import { DataSource } from 'typeorm';
import { AuthService } from './auth.service';
import { UserEntity } from '../../entities/users';
import { JwtService } from '@nestjs/jwt';

describe('AuthService', () => {
  let app: TestingModule;
  let dataSource: DataSource;
  let service: AuthService;
  let jwtService: jest.Mocked<JwtService>;
  let financeManagerEntity: UserEntity;

  beforeAll(async () => {
    app = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: JwtService, // Provide a mock for JwtService
          useValue: {},
        },
      ],
      imports: [AppModule],
    }).compile();

    service = app.get<AuthService>(AuthService);
    dataSource = app.get<DataSource>(DataSource);
    jwtService = app.get(JwtService);

    const user = new UserEntity();
    user.name = 'Finance Manager Test';
    user.email = 'finance.manager.test@mail';
    user.password = '12345';
    user.securityQuestion = '';
    user.securityAnswer = '';
    financeManagerEntity = await dataSource.createEntityManager().save(user);
  });

  afterAll(async () => {
    await dataSource.createEntityManager().remove(financeManagerEntity);
    await dataSource.destroy();
    await app.close();
  });

  describe('loginAttempt', () => {
    it('should successfully login', async () => {
      const loginResult = await service.loginAttempt({
        email: financeManagerEntity.email,
        password: '12345',
      });
      expect(loginResult.name).toBe(financeManagerEntity.name);
      expect(loginResult.email).toBe(financeManagerEntity.email);
      expect(loginResult.authenticationToken).toBeDefined();
    });

    it('should fail to login due to invalid username"', async () => {
      try {
        await service.loginAttempt({
          email: 'wrong.email@mail',
          password: '12345',
        });
      } catch (error) {
        expect(error.message).toBe(
          'The entered email address wrong.email@mail does not match any existing account.',
        );
      }
    });

    it('should fail to login due to password missmatch"', async () => {
      try {
        await service.loginAttempt({
          email: financeManagerEntity.email,
          password: '123456',
        });
      } catch (error) {
        expect(error.message).toBe(
          'The password you entered is incorrect. Please try again.',
        );
      }
    });
  });
});
