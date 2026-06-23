import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProductEntity } from '../../entities/products';
import { FlashSaleEntity } from '../../entities/flash-sales';
import { PurchaseEntity } from '../../entities/purchase';
import { UserEntity } from '../../entities/users';
import { FlashSaleController } from './flash-sale.controller';
import { FlashSaleProcessor } from './flash-sale.processor';
import { FlashSaleService } from './flash-sale.service';
import { BullModule } from '@nestjs/bullmq';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ProductEntity,
      FlashSaleEntity,
      PurchaseEntity,
      UserEntity,
    ]),

    BullModule.registerQueue({
      name: 'purchase-queue',
    }),
  ],
  controllers: [FlashSaleController],
  providers: [FlashSaleService, FlashSaleProcessor],
})
export class FlashSaleModule {}
