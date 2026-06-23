import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { entities } from './entities';
import { UserModule } from './modules/user/user.module';
import { AuthModule } from './modules/auth/auth.module';
import { FlashSaleModule } from './modules/flash-sale/flash-sale.module';
import { MailerModule } from '@nestjs-modules/mailer';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { BullModule } from '@nestjs/bullmq';

@Module({
  imports: [
    // Modules
    UserModule,
    AuthModule,
    FlashSaleModule,

    // Load configuration file
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),

    // TypeORM configuration
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        type: 'mysql',
        host: configService.get<string>('ARMS_DB_HOST'),
        port: configService.get<number>('ARMS_DB_PORT'),
        username: configService.get<string>('ARMS_DB_USER'),
        password: configService.get<string>('ARMS_DB_PASSWORD'),
        database: configService.get<string>('ARMS_DB_NAME'),
        entities,
        synchronize: true,
        timezone: 'Z',
      }),
    }),

    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: async (configService: ConfigService) => ({
        connection: {
          host: configService.get<string>('ARMS_REDIS_HOST'),
          port: configService.get<number>('ARMS_REDIS_PORT'),
        },
      }),
    }),

    MailerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        transport: {
          service: configService.get<string>('ARMS_NODEMAILER_SERVICE'),
          auth: {
            user: configService.get<string>('ARMS_NODEMAILER_AUTH_USER'),
            pass: configService.get<string>('ARMS_NODEMAILER_AUTH_PASS'),
          },
        },
      }),
    }),
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
