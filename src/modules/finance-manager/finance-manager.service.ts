import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { RegisterFinanceManagerDTO } from './finance-manager.dto';
import { FinanceManagerEntity } from '../../entities/finance-managers';

@Injectable()
export class FinanceManagerService {
  constructor(private dataSource: DataSource) {}

  async register(
    newRegisteredFinanceManager: RegisterFinanceManagerDTO,
  ): Promise<FinanceManagerEntity> {
    let newFinanceManager: FinanceManagerEntity = new FinanceManagerEntity();

    await this.dataSource.transaction(async (transactionalEntityManager) => {
      // Check if email exists in user data, throw 409 error if user exists
      const financeManager = await transactionalEntityManager.findOne(
        FinanceManagerEntity,
        {
          where: {
            email: newRegisteredFinanceManager.email,
          },
        },
      );

      if (financeManager) {
        throw new HttpException(
          `The email address ${newRegisteredFinanceManager.email} is already registered. Please use a different email address`,
          HttpStatus.CONFLICT,
        );
      }

      // Otherwise, proceed to add new user
      const insertedUser: FinanceManagerEntity = new FinanceManagerEntity();
      insertedUser.name = newRegisteredFinanceManager.name;
      insertedUser.password = newRegisteredFinanceManager.password;
      insertedUser.email = newRegisteredFinanceManager.email;
      insertedUser.securityQuestion =
        newRegisteredFinanceManager.securityQuestion ?? '';
      insertedUser.securityAnswer = newRegisteredFinanceManager.securityAnswer ?? '';

      newFinanceManager = await transactionalEntityManager.save(insertedUser);
    });

    return newFinanceManager;
  }
}
