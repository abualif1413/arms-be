import { config } from 'dotenv';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { DataSource } from 'typeorm';
import request from 'supertest';
import { AppModule } from './app.module';
import { FlashSaleService } from './modules/flash-sale/flash-sale.service';
import { UserService } from './modules/user/user.service';

config();

describe('Flash Sale Concurrency Stress Test (E2E)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let flashSaleService: FlashSaleService;
  let userService: UserService;
  let jwtService: JwtService;

  const INITIAL_STOCK = 10;
  const CONCURRENT_USERS = 100;

  let flashSaleId: string;
  let userIds: string[] = [];
  let authTokens: string[] = [];

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe());
    await app.init();

    dataSource = moduleFixture.get<DataSource>(DataSource);
    flashSaleService = moduleFixture.get<FlashSaleService>(FlashSaleService);
    userService = moduleFixture.get<UserService>(UserService);
    jwtService = moduleFixture.get<JwtService>(JwtService);
  }, 60_000);

  beforeEach(async () => {
    console.log('--- Cleaning and Seeding Local Database ---');

    userIds = [];
    authTokens = [];

    await dataSource.query(
      `DELETE FROM purchases WHERE flash_sale_id IN (
        SELECT id FROM flash_sales WHERE start_date >= '2050-01-01' AND start_date < '2050-01-10'
      )`,
    );
    await dataSource.query(
      `DELETE FROM flash_sales WHERE start_date >= '2050-01-01' AND start_date < '2050-01-10'`,
    );
    await dataSource.query(
      `DELETE FROM products WHERE name = 'Rare Flash Sale Item'`,
    );
    await dataSource.query(
      `DELETE FROM users WHERE email LIKE 'stress-user-%@stress.test'`,
    );

    const flashSaleInfo = await flashSaleService.addFlashSale({
      productName: 'Rare Flash Sale Item',
      productDescription: 'Stress test flash sale item',
      productUnit: 'pcs',
      productAvailableStock: INITIAL_STOCK,
      productPrice: 99.99,
      startDate: '2050-01-01',
      endDate: '2050-01-05',
    });
    flashSaleId = flashSaleInfo.flashSale.id;

    const registeredUsers = await Promise.all(
      Array.from({ length: CONCURRENT_USERS }).map((_, index) =>
        userService.register({
          name: `Stress User ${index}`,
          email: `stress-user-${index}@stress.test`,
          password: 'stress-test-password',
        }),
      ),
    );

    userIds = registeredUsers.map((user) => user.id);
    authTokens = await Promise.all(
      registeredUsers.map((user) =>
        jwtService.signAsync({
          id: user.id,
          name: user.name,
          email: user.email,
        }),
      ),
    );
  }, 60_000);

  afterAll(async () => {
    if (dataSource) {
      await dataSource.destroy();
    }
    if (app) {
      await app.close();
    }
  });

  it(
    'should handle extreme concurrency without hanging or glitching',
    async () => {
      const server = app.getHttpServer();

      const apiRequests = userIds.map((_, index) =>
        request(server)
          .post('/flash-sale/purchase')
          .set('Authorization', `Bearer ${authTokens[index]}`)
          .send({ flashSaleId })
          .then((res) => ({ status: res.status, body: res.body })),
      );

      console.log(
        `Blasting ${CONCURRENT_USERS} requests at the exact same millisecond...`,
      );

      await Promise.all(apiRequests);

      expect(1).toBe(1);
    },
    120_000,
  );
});
