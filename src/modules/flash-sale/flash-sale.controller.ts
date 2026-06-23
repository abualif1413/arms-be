import {
  Body,
  Controller,
  Get,
  HttpException,
  HttpStatus,
  Post,
} from '@nestjs/common';
import { FlashSaleService } from './flash-sale.service';
import {
  FlashSaleInfoResponseDTO,
  NewFlashSaleDTO,
  PurchaseFlashSaleRequestDTO,
} from './flash-sale.dto';
import { User } from '../../decorators/user';
import { UserDecoratorDTO } from '../../decorators/user-decorator.dto';
import { PurchaseEntity } from '../../entities/purchase';

@Controller('flash-sale')
export class FlashSaleController {
  constructor(private readonly flashSaleService: FlashSaleService) {}

  @Post()
  async create(
    @Body() body: NewFlashSaleDTO,
  ): Promise<FlashSaleInfoResponseDTO> {
    const result = await this.flashSaleService.addFlashSale(body);
    return { flashSaleInfo: result };
  }

  @Post('purchase')
  async purchaseFlashSale(
    @Body() body: PurchaseFlashSaleRequestDTO,
    @User() user: UserDecoratorDTO,
  ): Promise<PurchaseEntity> {
    if (!user) {
      throw new HttpException(`Unauthorized user.`, HttpStatus.UNAUTHORIZED);
    }

    return this.flashSaleService.purchaseFlashSale({
      userId: user.id,
      flashSaleId: body.flashSaleId,
    });
  }

  @Get()
  async getActive(): Promise<FlashSaleInfoResponseDTO> {
    const result = await this.flashSaleService.todayFlashSale();
    return { flashSaleInfo: result };
  }

  @Get('recent')
  async getRecent(): Promise<FlashSaleInfoResponseDTO> {
    const result = await this.flashSaleService.getRecentFlashSale();
    return { flashSaleInfo: result };
  }

  @Get('upcoming')
  async getUpcoming(): Promise<FlashSaleInfoResponseDTO> {
    const result = await this.flashSaleService.getUpcomingFlashSale();
    return { flashSaleInfo: result };
  }
}
