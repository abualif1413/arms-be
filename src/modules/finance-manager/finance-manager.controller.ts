import { Body, Controller, Post } from '@nestjs/common';
import { FinanceManagerService } from './finance-manager.service';
import { RegisterFinanceManagerDTO } from './finance-manager.dto';
import { FinanceManagerEntity } from '../../entities/finance-managers';

@Controller('finance-managers')
export class FinanceManagerController {
  constructor(private financeManagerService: FinanceManagerService) {}

  @Post('register')
  async register(
    @Body() registerFinanceManagerDto: RegisterFinanceManagerDTO,
  ): Promise<FinanceManagerEntity> {
    return this.financeManagerService.register(registerFinanceManagerDto);
  }
}
