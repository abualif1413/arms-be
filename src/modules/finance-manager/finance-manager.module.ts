import { Module } from '@nestjs/common';
import { FinanceManagerService } from './finance-manager.service';
import { FinanceManagerController } from './finance-manager.controller';

@Module({
  imports: [],
  controllers: [FinanceManagerController],
  providers: [FinanceManagerService],
})
export class FinanceManagerModule {}
