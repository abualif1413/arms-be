import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { InjectRepository } from '@nestjs/typeorm';
import { Queue } from 'bullmq';
import * as crypto from 'crypto';
import { DataSource, In, LessThan, MoreThan, Repository } from 'typeorm';
import { ProductEntity } from '../../entities/products';
import { FlashSaleEntity } from '../../entities/flash-sales';
import { PurchaseEntity, PurchaseStatus } from '../../entities/purchase';
import { UserEntity } from '../../entities/users';
import {
  FlashSaleInfoDTO,
  NewFlashSaleDTO,
  PurchaseDTO,
} from './flash-sale.dto';

@Injectable()
export class FlashSaleService {
  constructor(
    @InjectRepository(ProductEntity)
    private readonly productRepository: Repository<ProductEntity>,
    @InjectRepository(FlashSaleEntity)
    private readonly flashSaleRepository: Repository<FlashSaleEntity>,
    @InjectQueue('purchase-queue')
    private readonly purchaseQueue: Queue,
    private readonly dataSource: DataSource,
  ) {}

  private mapToFlashSaleInfo(
    flashSale: FlashSaleEntity,
    product: ProductEntity,
  ): FlashSaleInfoDTO {
    return {
      product,
      flashSale,
    };
  }

  private generatePurchaseCode(): string {
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const random = crypto.randomBytes(4).toString('hex').toUpperCase();
    return `FS-${dateStr}-${random}`;
  }

  async addFlashSale(dto: NewFlashSaleDTO): Promise<FlashSaleInfoDTO> {
    const startDate = new Date(dto.startDate);
    const endDate = new Date(dto.endDate);
    const now = new Date();

    if (startDate >= endDate) {
      throw new HttpException(
        'Start date must be earlier than end date.',
        HttpStatus.BAD_REQUEST,
      );
    }

    if (startDate <= now) {
      throw new HttpException(
        'Start date must be a future date.',
        HttpStatus.BAD_REQUEST,
      );
    }

    const overlappingFlashSale = await this.flashSaleRepository
      .createQueryBuilder('flashSale')
      .where('flashSale.start_date < :endDate', { endDate })
      .andWhere('flashSale.end_date > :startDate', { startDate })
      .getOne();

    if (overlappingFlashSale) {
      throw new HttpException(
        'The flash sale date range overlaps with an existing flash sale schedule.',
        HttpStatus.CONFLICT,
      );
    }

    return this.productRepository.manager.transaction(
      async (transactionalEntityManager) => {
        const product = await transactionalEntityManager.save(ProductEntity, {
          name: dto.productName,
          unit: dto.productUnit,
          availableStock: dto.productAvailableStock,
        });

        const flashSale = await transactionalEntityManager.save(
          FlashSaleEntity,
          {
            startDate,
            endDate,
            product,
          },
        );

        return this.mapToFlashSaleInfo(flashSale, product);
      },
    );
  }

  async purchaseFlashSale(dto: PurchaseDTO): Promise<PurchaseEntity> {
    let purchase: PurchaseEntity;

    await this.dataSource.transaction(async (manager) => {
      const flashSale = await manager
        .createQueryBuilder(FlashSaleEntity, 'flashSale')
        .leftJoinAndSelect('flashSale.product', 'product')
        .where('flashSale.id = :id', { id: dto.flashSaleId })
        .setLock('pessimistic_write')
        .getOne();

      if (!flashSale) {
        throw new HttpException('Flash sale not found.', HttpStatus.NOT_FOUND);
      }

      const user = await manager.findOne(UserEntity, {
        where: { id: dto.userId },
      });

      if (!user) {
        throw new HttpException('User not found.', HttpStatus.UNAUTHORIZED);
      }

      const soldCount = await manager.count(PurchaseEntity, {
        where: {
          flashSale: { id: dto.flashSaleId },
          status: In([PurchaseStatus.PROCESSING, PurchaseStatus.DONE]),
        },
      });

      if (soldCount >= flashSale.product.availableStock) {
        throw new HttpException(
          'This flash sale is sold out',
          HttpStatus.CONFLICT,
        );
      }

      const existingPurchase = await manager.findOne(PurchaseEntity, {
        where: {
          flashSale: { id: dto.flashSaleId },
          user: { id: dto.userId },
          status: In([PurchaseStatus.PROCESSING, PurchaseStatus.DONE]),
        },
      });

      if (existingPurchase) {
        throw new HttpException(
          'The user has already purchased during this flash sale period',
          HttpStatus.CONFLICT,
        );
      }

      const purchaseCode = this.generatePurchaseCode();

      purchase = await manager.save(PurchaseEntity, {
        flashSale,
        user,
        purchaseCode,
        status: PurchaseStatus.PROCESSING,
      });
    });

    await this.purchaseQueue.add(
      'proceed-purchase',
      {
        purchaseId: purchase!.id,
      },
      {
        attempts: 3,
        backoff: 5000,
      },
    );

    return purchase!;
  }

  async todayFlashSale(): Promise<FlashSaleInfoDTO | null> {
    const now = new Date();

    const flashSale = await this.flashSaleRepository
      .createQueryBuilder('flashSale')
      .leftJoinAndSelect('flashSale.product', 'product')
      .where('flashSale.start_date <= :now', { now })
      .andWhere('flashSale.end_date >= :now', { now })
      .getOne();

    if (!flashSale) {
      return null;
    }

    return this.mapToFlashSaleInfo(flashSale, flashSale.product);
  }

  async getRecentFlashSale(): Promise<FlashSaleInfoDTO | null> {
    const now = new Date();

    const flashSale = await this.flashSaleRepository.findOne({
      where: {
        endDate: LessThan(now),
      },
      relations: ['product'],
      order: {
        endDate: 'DESC',
      },
    });

    if (!flashSale) {
      return null;
    }

    return this.mapToFlashSaleInfo(flashSale, flashSale.product);
  }

  async getUpcomingFlashSale(): Promise<FlashSaleInfoDTO | null> {
    const now = new Date();

    const flashSale = await this.flashSaleRepository.findOne({
      where: {
        startDate: MoreThan(now),
      },
      relations: ['product'],
      order: {
        startDate: 'ASC',
      },
    });

    if (!flashSale) {
      return null;
    }

    return this.mapToFlashSaleInfo(flashSale, flashSale.product);
  }
}
