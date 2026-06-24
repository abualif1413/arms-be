import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { getQueueToken } from '@nestjs/bullmq';
import { HttpStatus, Logger } from '@nestjs/common';
import { MailerService } from '@nestjs-modules/mailer';
import { DataSource } from 'typeorm';
import { Job } from 'bullmq';
import { FlashSaleService } from './flash-sale.service';
import { FlashSaleProcessor } from './flash-sale.processor';
import { ProductEntity } from '../../entities/products';
import { FlashSaleEntity } from '../../entities/flash-sales';
import { PurchaseEntity, PurchaseStatus } from '../../entities/purchase';
import { UserEntity } from '../../entities/users';
import { NewFlashSaleDTO } from './flash-sale.dto';

describe('FlashSaleService', () => {
  let service: FlashSaleService;
  let productRepository: {
    manager: { transaction: jest.Mock };
  };
  let flashSaleRepository: {
    createQueryBuilder: jest.Mock;
    findOne: jest.Mock;
  };
  let purchaseQueue: { add: jest.Mock };
  let dataSource: { transaction: jest.Mock };

  const mockProduct = (overrides: Partial<ProductEntity> = {}): ProductEntity =>
    ({
      id: 'product-id',
      name: 'Test Product',
      description: 'A test product',
      unit: 'pcs',
      availableStock: 10,
      price: 99.99,
      createdAt: new Date(),
      updatedAt: new Date(),
      ...overrides,
    }) as ProductEntity;

  const mockFlashSale = (
    overrides: Partial<FlashSaleEntity> = {},
  ): FlashSaleEntity =>
    ({
      id: 'flash-sale-id',
      startDate: new Date('2030-01-01'),
      endDate: new Date('2030-01-31'),
      product: mockProduct(),
      purchases: [],
      createdAt: new Date(),
      updatedAt: new Date(),
      ...overrides,
    }) as FlashSaleEntity;

  const mockUser = (overrides: Partial<UserEntity> = {}): UserEntity =>
    ({
      id: 'user-id',
      name: 'Test User',
      email: 'test@mail.com',
      password: 'hashed',
      securityQuestion: '',
      securityAnswer: '',
      ...overrides,
    }) as UserEntity;

  const validNewFlashSaleDto = (): NewFlashSaleDTO => {
    const start = new Date();
    start.setDate(start.getDate() + 2);
    const end = new Date();
    end.setDate(end.getDate() + 5);

    return {
      productName: 'Flash Product',
      productDescription: 'Limited offer',
      productUnit: 'pcs',
      productAvailableStock: 100,
      productPrice: 49.99,
      startDate: start.toISOString(),
      endDate: end.toISOString(),
    };
  };

  const createQueryBuilderMock = (getOneResult: unknown) => ({
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    leftJoinAndSelect: jest.fn().mockReturnThis(),
    setLock: jest.fn().mockReturnThis(),
    getOne: jest.fn().mockResolvedValue(getOneResult),
  });

  beforeEach(async () => {
    productRepository = {
      manager: {
        transaction: jest.fn(),
      },
    };

    flashSaleRepository = {
      createQueryBuilder: jest.fn(),
      findOne: jest.fn(),
    };

    purchaseQueue = {
      add: jest.fn().mockResolvedValue(undefined),
    };

    dataSource = {
      transaction: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FlashSaleService,
        {
          provide: getRepositoryToken(ProductEntity),
          useValue: productRepository,
        },
        {
          provide: getRepositoryToken(FlashSaleEntity),
          useValue: flashSaleRepository,
        },
        {
          provide: getQueueToken('purchase-queue'),
          useValue: purchaseQueue,
        },
        {
          provide: DataSource,
          useValue: dataSource,
        },
      ],
    }).compile();

    service = module.get<FlashSaleService>(FlashSaleService);
  });

  describe('addFlashSale', () => {
    it('should reject when start date is not earlier than end date', async () => {
      const dto = validNewFlashSaleDto();
      dto.endDate = dto.startDate;

      await expect(service.addFlashSale(dto)).rejects.toMatchObject({
        response: 'Start date must be earlier than end date.',
        status: HttpStatus.BAD_REQUEST,
      });
    });

    it('should reject when start date is not in the future', async () => {
      const dto = validNewFlashSaleDto();
      const past = new Date();
      past.setDate(past.getDate() - 1);
      const future = new Date();
      future.setDate(future.getDate() + 5);
      dto.startDate = past.toISOString();
      dto.endDate = future.toISOString();

      await expect(service.addFlashSale(dto)).rejects.toMatchObject({
        response: 'Start date must be a future date.',
        status: HttpStatus.BAD_REQUEST,
      });
    });

    it('should reject when date range overlaps an existing flash sale', async () => {
      const dto = validNewFlashSaleDto();
      const overlappingQueryBuilder = createQueryBuilderMock(mockFlashSale());
      flashSaleRepository.createQueryBuilder.mockReturnValue(
        overlappingQueryBuilder,
      );

      await expect(service.addFlashSale(dto)).rejects.toMatchObject({
        response:
          'The flash sale date range overlaps with an existing flash sale schedule.',
        status: HttpStatus.CONFLICT,
      });
    });

    it('should create product and flash sale in a transaction', async () => {
      const dto = validNewFlashSaleDto();
      const noOverlapQueryBuilder = createQueryBuilderMock(null);
      flashSaleRepository.createQueryBuilder.mockReturnValue(
        noOverlapQueryBuilder,
      );

      const savedProduct = mockProduct({ name: dto.productName });
      const savedFlashSale = mockFlashSale({ product: savedProduct });

      const transactionalEntityManager = {
        save: jest
          .fn()
          .mockResolvedValueOnce(savedProduct)
          .mockResolvedValueOnce(savedFlashSale),
      };

      productRepository.manager.transaction.mockImplementation(
        async (
          callback: (manager: typeof transactionalEntityManager) => unknown,
        ) => callback(transactionalEntityManager),
      );

      const result = await service.addFlashSale(dto);

      expect(productRepository.manager.transaction).toHaveBeenCalled();
      expect(transactionalEntityManager.save).toHaveBeenNthCalledWith(
        1,
        ProductEntity,
        {
          name: dto.productName,
          unit: dto.productUnit,
          description: dto.productDescription,
          availableStock: dto.productAvailableStock,
          price: dto.productPrice,
        },
      );
      expect(result).toEqual({
        product: savedProduct,
        flashSale: savedFlashSale,
      });
    });
  });

  describe('purchaseFlashSale', () => {
    const purchaseDto = {
      userId: 'user-id',
      flashSaleId: 'flash-sale-id',
    };

    const setupTransaction = (manager: Record<string, jest.Mock>) => {
      dataSource.transaction.mockImplementation(
        async (callback: (m: typeof manager) => unknown) => callback(manager),
      );
    };

    it('should reject when flash sale is not found or not active', async () => {
      const queryBuilder = createQueryBuilderMock(null);
      setupTransaction({
        createQueryBuilder: jest.fn().mockReturnValue(queryBuilder),
      });

      await expect(
        service.purchaseFlashSale(purchaseDto),
      ).rejects.toMatchObject({
        response: 'Flash sale not found.',
        status: HttpStatus.NOT_FOUND,
      });
    });

    it('should reject when user is not found', async () => {
      const flashSale = mockFlashSale();
      const queryBuilder = createQueryBuilderMock(flashSale);
      const findOne = jest.fn().mockResolvedValue(null);

      setupTransaction({
        createQueryBuilder: jest.fn().mockReturnValue(queryBuilder),
        findOne,
      });

      await expect(
        service.purchaseFlashSale(purchaseDto),
      ).rejects.toMatchObject({
        response: 'User not found.',
        status: HttpStatus.UNAUTHORIZED,
      });
    });

    it('should reject when flash sale is sold out', async () => {
      const flashSale = mockFlashSale({
        product: mockProduct({ availableStock: 2 }),
      });
      const queryBuilder = createQueryBuilderMock(flashSale);
      const findOne = jest
        .fn()
        .mockResolvedValueOnce(mockUser())
        .mockResolvedValueOnce(null);
      const count = jest.fn().mockResolvedValue(2);

      setupTransaction({
        createQueryBuilder: jest.fn().mockReturnValue(queryBuilder),
        findOne,
        count,
      });

      await expect(
        service.purchaseFlashSale(purchaseDto),
      ).rejects.toMatchObject({
        response: 'This flash sale is sold out',
        status: HttpStatus.CONFLICT,
      });
    });

    it('should reject when user already purchased during the flash sale', async () => {
      const flashSale = mockFlashSale();
      const queryBuilder = createQueryBuilderMock(flashSale);
      const existingPurchase = {
        id: 'existing-purchase-id',
        status: PurchaseStatus.PROCESSING,
      } as PurchaseEntity;
      const findOne = jest
        .fn()
        .mockResolvedValueOnce(mockUser())
        .mockResolvedValueOnce(existingPurchase);
      const count = jest.fn().mockResolvedValue(0);

      setupTransaction({
        createQueryBuilder: jest.fn().mockReturnValue(queryBuilder),
        findOne,
        count,
      });

      await expect(
        service.purchaseFlashSale(purchaseDto),
      ).rejects.toMatchObject({
        response:
          'The user has already purchased during this flash sale period',
        status: HttpStatus.CONFLICT,
      });
    });

    it('should create purchase and enqueue processing job', async () => {
      const flashSale = mockFlashSale();
      const user = mockUser();
      const queryBuilder = createQueryBuilderMock(flashSale);
      const savedPurchase = {
        id: 'purchase-id',
        flashSale,
        user,
        purchaseCode: 'FS-20300101-ABCD1234',
        status: PurchaseStatus.PROCESSING,
      } as PurchaseEntity;

      const findOne = jest
        .fn()
        .mockResolvedValueOnce(user)
        .mockResolvedValueOnce(null);
      const count = jest.fn().mockResolvedValue(0);
      const save = jest.fn().mockResolvedValue(savedPurchase);

      setupTransaction({
        createQueryBuilder: jest.fn().mockReturnValue(queryBuilder),
        findOne,
        count,
        save,
      });

      const result = await service.purchaseFlashSale(purchaseDto);

      expect(save).toHaveBeenCalledWith(
        PurchaseEntity,
        expect.objectContaining({
          flashSale,
          user,
          status: PurchaseStatus.PROCESSING,
          purchaseCode: expect.stringMatching(/^FS-\d{8}-[A-F0-9]{8}$/),
        }),
      );
      expect(purchaseQueue.add).toHaveBeenCalledWith(
        'proceed-purchase',
        { purchaseId: savedPurchase.id },
        { attempts: 3, backoff: 5000 },
      );
      expect(result).toBe(savedPurchase);
    });
  });

  describe('todayFlashSale', () => {
    it('should return null when no active flash sale exists', async () => {
      flashSaleRepository.createQueryBuilder.mockReturnValue(
        createQueryBuilderMock(null),
      );

      const result = await service.todayFlashSale('user-id');

      expect(result).toBeNull();
    });

    it('should return flash sale info for an active flash sale', async () => {
      const flashSale = mockFlashSale();
      flashSaleRepository.createQueryBuilder.mockReturnValue(
        createQueryBuilderMock(flashSale),
      );

      const result = await service.todayFlashSale('user-id');

      expect(result).toEqual({
        product: flashSale.product,
        flashSale,
      });
    });
  });

  describe('getRecentFlashSale', () => {
    it('should return null when no past flash sale exists', async () => {
      flashSaleRepository.findOne.mockResolvedValue(null);

      const result = await service.getRecentFlashSale();

      expect(result).toBeNull();
      expect(flashSaleRepository.findOne).toHaveBeenCalled();
    });

    it('should return the most recent ended flash sale', async () => {
      const flashSale = mockFlashSale({
        endDate: new Date('2020-01-01'),
      });
      flashSaleRepository.findOne.mockResolvedValue(flashSale);

      const result = await service.getRecentFlashSale();

      expect(result).toEqual({
        product: flashSale.product,
        flashSale,
      });
    });
  });

  describe('getUpcomingFlashSale', () => {
    it('should return null when no upcoming flash sale exists', async () => {
      flashSaleRepository.findOne.mockResolvedValue(null);

      const result = await service.getUpcomingFlashSale();

      expect(result).toBeNull();
      expect(flashSaleRepository.findOne).toHaveBeenCalled();
    });

    it('should return the nearest upcoming flash sale', async () => {
      const flashSale = mockFlashSale({
        startDate: new Date('2099-01-01'),
        endDate: new Date('2099-01-31'),
      });
      flashSaleRepository.findOne.mockResolvedValue(flashSale);

      const result = await service.getUpcomingFlashSale();

      expect(result).toEqual({
        product: flashSale.product,
        flashSale,
      });
    });
  });
});

describe('FlashSaleProcessor', () => {
  let processor: FlashSaleProcessor;
  let purchaseRepository: {
    findOne: jest.Mock;
    save: jest.Mock;
  };
  let mailerService: {
    sendMail: jest.Mock;
  };

  const mockPurchase = (
    overrides: Partial<PurchaseEntity> = {},
  ): PurchaseEntity =>
    ({
      id: 'purchase-id',
      status: PurchaseStatus.PROCESSING,
      purchaseCode: 'FS-20300101-ABCDEF12',
      message: null,
      user: {
        id: 'user-id',
        email: 'buyer@mail.com',
      } as UserEntity,
      flashSale: { id: 'flash-sale-id' } as FlashSaleEntity,
      ...overrides,
    }) as PurchaseEntity;

  beforeEach(async () => {
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);

    purchaseRepository = {
      findOne: jest.fn(),
      save: jest.fn().mockImplementation((entity) => Promise.resolve(entity)),
    };

    mailerService = {
      sendMail: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FlashSaleProcessor,
        {
          provide: getRepositoryToken(PurchaseEntity),
          useValue: purchaseRepository,
        },
        {
          provide: MailerService,
          useValue: mailerService,
        },
      ],
    }).compile();

    processor = module.get<FlashSaleProcessor>(FlashSaleProcessor);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('process', () => {
    it('should handle proceed-purchase jobs', async () => {
      const purchase = mockPurchase();
      purchaseRepository.findOne.mockResolvedValue(purchase);

      await processor.process({
        name: 'proceed-purchase',
        data: { purchaseId: purchase.id },
      } as Job);

      expect(mailerService.sendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: purchase.user.email,
          subject: 'Flash Sale Purchase Success',
        }),
      );
      expect(purchase.status).toBe(PurchaseStatus.DONE);
      expect(purchaseRepository.save).toHaveBeenCalledWith(purchase);
    });

    it('should throw when job name is not recognized', async () => {
      await expect(
        processor.process({ name: 'unknown-job', data: {} } as Job),
      ).rejects.toThrow('No handler found for job name: unknown-job');
    });

    it('should mark purchase as failed when email sending fails', async () => {
      const purchase = mockPurchase();
      purchaseRepository.findOne.mockResolvedValue(purchase);
      mailerService.sendMail.mockRejectedValue(new Error('SMTP unavailable'));

      await expect(
        processor.process({
          name: 'proceed-purchase',
          data: { purchaseId: purchase.id },
        } as Job),
      ).rejects.toThrow('SMTP unavailable');

      expect(purchase.status).toBe(PurchaseStatus.FAILED);
      expect(purchase.message).toBe('SMTP unavailable');
      expect(purchaseRepository.save).toHaveBeenCalledWith(purchase);
    });

    it('should throw when purchase is not found', async () => {
      purchaseRepository.findOne.mockResolvedValue(null);

      await expect(
        processor.process({
          name: 'proceed-purchase',
          data: { purchaseId: 'missing-id' },
        } as Job),
      ).rejects.toThrow('Purchase with id missing-id not found');
    });
  });
});
