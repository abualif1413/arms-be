import { Type } from 'class-transformer';
import {
  IsDateString,
  IsEmpty,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsString,
  Min,
} from 'class-validator';
import { ProductEntity } from '../../entities/products';
import { FlashSaleEntity } from '../../entities/flash-sales';

export class NewFlashSaleDTO {
  @IsString()
  @IsNotEmpty({ message: 'Product name is required' })
  productName: string;

  @IsString()
  @IsNotEmpty({ message: 'Product description is required' })
  productDescription: string;

  @IsString()
  @IsNotEmpty({ message: 'Product unit is required' })
  productUnit: string;

  @Type(() => Number)
  @IsInt({ message: 'Product available stock must be an integer' })
  @Min(0, { message: 'Product available stock must be at least 0' })
  @IsNotEmpty({ message: 'Product available stock is required' })
  productAvailableStock: number;

  @Type(() => Number)
  @IsNumber()
  @Min(1, { message: 'Product price must be at least 1' })
  @IsNotEmpty({ message: 'Product price is required' })
  productPrice: number;

  @IsDateString({}, { message: 'Start date must be a valid date string' })
  @IsNotEmpty({ message: 'Start date is required' })
  startDate: string;

  @IsDateString({}, { message: 'End date must be a valid date string' })
  @IsNotEmpty({ message: 'End date is required' })
  endDate: string;
}

export class FlashSaleInfoDTO {
  product: ProductEntity;
  flashSale: FlashSaleEntity;
}

export class FlashSaleInfoResponseDTO {
  flashSaleInfo: FlashSaleInfoDTO | null;
}

export class PurchaseDTO {
  @IsNotEmpty({ message: 'userId is required' })
  userId: string;

  @IsNotEmpty({ message: 'flashSaleId is required' })
  flashSaleId: string;
}

export class PurchaseFlashSaleRequestDTO {
  @IsNotEmpty({ message: 'flashSaleId is required' })
  flashSaleId: string;
}
