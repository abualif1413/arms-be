import { Test, TestingModule } from '@nestjs/testing';
import { HttpStatus } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { FlashSaleController } from './flash-sale.controller';
import { FlashSaleService } from './flash-sale.service';
import { FlashSaleModule } from './flash-sale.module';
import { NewFlashSaleDTO } from './flash-sale.dto';
import { UserDecoratorDTO } from '../../decorators/user-decorator.dto';
import { FlashSaleEntity } from '../../entities/flash-sales';
import { ProductEntity } from '../../entities/products';
import { PurchaseEntity, PurchaseStatus } from '../../entities/purchase';

describe('FlashSaleController', () => {
  let controller: FlashSaleController;
  let flashSaleService: {
    addFlashSale: jest.Mock;
    purchaseFlashSale: jest.Mock;
    todayFlashSale: jest.Mock;
    getRecentFlashSale: jest.Mock;
    getUpcomingFlashSale: jest.Mock;
  };

  const mockProduct = (): ProductEntity =>
    ({
      id: 'product-id',
      name: 'Controller Product',
      description: 'From controller test',
      unit: 'pcs',
      availableStock: 50,
      price: 25,
    }) as ProductEntity;

  const mockFlashSale = (): FlashSaleEntity =>
    ({
      id: 'flash-sale-id',
      startDate: new Date('2030-06-01'),
      endDate: new Date('2030-06-30'),
      product: mockProduct(),
    }) as FlashSaleEntity;

  const mockUser = (): UserDecoratorDTO => ({
    id: 'user-id',
    name: 'Controller User',
    email: 'controller.user@mail.com',
  });

  beforeEach(async () => {
    flashSaleService = {
      addFlashSale: jest.fn(),
      purchaseFlashSale: jest.fn(),
      todayFlashSale: jest.fn(),
      getRecentFlashSale: jest.fn(),
      getUpcomingFlashSale: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [FlashSaleController],
      providers: [
        {
          provide: FlashSaleService,
          useValue: flashSaleService,
        },
      ],
    }).compile();

    controller = module.get<FlashSaleController>(FlashSaleController);
  });

  describe('create', () => {
    it('should delegate to the service and wrap the result', async () => {
      const body: NewFlashSaleDTO = {
        productName: 'New Product',
        productDescription: 'Description',
        productUnit: 'box',
        productAvailableStock: 20,
        productPrice: 10,
        startDate: '2030-07-01T00:00:00.000Z',
        endDate: '2030-07-31T00:00:00.000Z',
      };
      const flashSaleInfo = {
        product: mockProduct(),
        flashSale: mockFlashSale(),
      };
      flashSaleService.addFlashSale.mockResolvedValue(flashSaleInfo);

      const result = await controller.create(body);

      expect(flashSaleService.addFlashSale).toHaveBeenCalledWith(body);
      expect(result).toEqual({ flashSaleInfo });
    });
  });

  describe('purchaseFlashSale', () => {
    it.each([null, undefined])(
      'should reject unauthenticated requests when user is %s',
      async (user) => {
        await expect(
          controller.purchaseFlashSale(
            { flashSaleId: 'flash-sale-id' },
            user as unknown as UserDecoratorDTO,
          ),
        ).rejects.toMatchObject({
          response: 'Unauthorized user.',
          status: HttpStatus.UNAUTHORIZED,
        });

        expect(flashSaleService.purchaseFlashSale).not.toHaveBeenCalled();
      },
    );

    it('should pass user id and flash sale id to the service', async () => {
      const user = mockUser();
      const purchase = {
        id: 'purchase-id',
        status: PurchaseStatus.PROCESSING,
        purchaseCode: 'FS-20300701-ABCDEF12',
      } as PurchaseEntity;
      flashSaleService.purchaseFlashSale.mockResolvedValue(purchase);

      const result = await controller.purchaseFlashSale(
        { flashSaleId: 'flash-sale-id' },
        user,
      );

      expect(flashSaleService.purchaseFlashSale).toHaveBeenCalledWith({
        userId: user.id,
        flashSaleId: 'flash-sale-id',
      });
      expect(result).toBe(purchase);
    });
  });

  describe('getActive', () => {
    it.each([null, undefined])(
      'should reject unauthenticated requests when user is %s',
      async (user) => {
        await expect(
          controller.getActive(user as unknown as UserDecoratorDTO),
        ).rejects.toMatchObject({
          response: 'Unauthorized user.',
          status: HttpStatus.UNAUTHORIZED,
        });

        expect(flashSaleService.todayFlashSale).not.toHaveBeenCalled();
      },
    );

    it('should return today flash sale for the authenticated user', async () => {
      const user = mockUser();
      const flashSaleInfo = {
        product: mockProduct(),
        flashSale: mockFlashSale(),
      };
      flashSaleService.todayFlashSale.mockResolvedValue(flashSaleInfo);

      const result = await controller.getActive(user);

      expect(flashSaleService.todayFlashSale).toHaveBeenCalledWith(user.id);
      expect(result).toEqual({ flashSaleInfo });
    });

    it('should return null flash sale info when none is active', async () => {
      const user = mockUser();
      flashSaleService.todayFlashSale.mockResolvedValue(null);

      const result = await controller.getActive(user);

      expect(result).toEqual({ flashSaleInfo: null });
    });
  });

  describe('getRecent', () => {
    it('should return the most recent flash sale', async () => {
      const flashSaleInfo = {
        product: mockProduct(),
        flashSale: mockFlashSale(),
      };
      flashSaleService.getRecentFlashSale.mockResolvedValue(flashSaleInfo);

      const result = await controller.getRecent();

      expect(flashSaleService.getRecentFlashSale).toHaveBeenCalled();
      expect(result).toEqual({ flashSaleInfo });
    });

    it('should return null when no recent flash sale exists', async () => {
      flashSaleService.getRecentFlashSale.mockResolvedValue(null);

      const result = await controller.getRecent();

      expect(result).toEqual({ flashSaleInfo: null });
    });
  });

  describe('getUpcoming', () => {
    it('should return the upcoming flash sale', async () => {
      const flashSaleInfo = {
        product: mockProduct(),
        flashSale: mockFlashSale(),
      };
      flashSaleService.getUpcomingFlashSale.mockResolvedValue(flashSaleInfo);

      const result = await controller.getUpcoming();

      expect(flashSaleService.getUpcomingFlashSale).toHaveBeenCalled();
      expect(result).toEqual({ flashSaleInfo });
    });

    it('should return null when no upcoming flash sale exists', async () => {
      flashSaleService.getUpcomingFlashSale.mockResolvedValue(null);

      const result = await controller.getUpcoming();

      expect(result).toEqual({ flashSaleInfo: null });
    });
  });

  describe('NewFlashSaleDTO', () => {
    it('should transform string numbers into numeric fields', async () => {
      const dto = plainToInstance(NewFlashSaleDTO, {
        productName: 'Product',
        productDescription: 'Description',
        productUnit: 'pcs',
        productAvailableStock: '25',
        productPrice: '19.99',
        startDate: '2030-08-01T00:00:00.000Z',
        endDate: '2030-08-31T00:00:00.000Z',
      });

      const errors = await validate(dto);

      expect(errors).toHaveLength(0);
      expect(dto.productAvailableStock).toBe(25);
      expect(dto.productPrice).toBe(19.99);
    });

    it('should reject invalid numeric fields', async () => {
      const dto = plainToInstance(NewFlashSaleDTO, {
        productName: 'Product',
        productDescription: 'Description',
        productUnit: 'pcs',
        productAvailableStock: 'not-a-number',
        productPrice: 0,
        startDate: '2030-08-01T00:00:00.000Z',
        endDate: '2030-08-31T00:00:00.000Z',
      });

      const errors = await validate(dto);

      expect(errors.length).toBeGreaterThan(0);
    });
  });
});

describe('FlashSaleModule', () => {
  it('should be defined', () => {
    expect(FlashSaleModule).toBeDefined();
  });
});
