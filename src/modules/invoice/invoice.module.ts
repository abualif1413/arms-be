import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { InvoiceController } from './invoice.controller';
import { InvoiceService } from './invoice.service';
import { ConfigModule, ConfigService } from '@nestjs/config';

@Module({
  imports: [
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        global: true,
        secret: configService.get<string>('ARMS_JWT_SECRET'),
      }),
    }),
  ],
  controllers: [InvoiceController],
  providers: [InvoiceService],
})
export class InvoiceModule {}
