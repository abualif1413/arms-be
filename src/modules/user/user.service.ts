import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { RegisterUserDTO } from './user.dto';
import { UserEntity } from '../../entities/users';

@Injectable()
export class UserService {
  constructor(private dataSource: DataSource) {}

  async register(newRegisteredUser: RegisterUserDTO): Promise<UserEntity> {
    let newFinanceManager: UserEntity = new UserEntity();

    await this.dataSource.transaction(async (transactionalEntityManager) => {
      // Check if email exists in user data, throw 409 error if user exists
      const user = await transactionalEntityManager.findOne(UserEntity, {
        where: {
          email: newRegisteredUser.email,
        },
      });

      if (user) {
        throw new HttpException(
          `The email address ${newRegisteredUser.email} is already registered. Please use a different email address`,
          HttpStatus.CONFLICT,
        );
      }

      // Otherwise, proceed to add new user
      const insertedUser: UserEntity = new UserEntity();
      insertedUser.name = newRegisteredUser.name;
      insertedUser.password = newRegisteredUser.password;
      insertedUser.email = newRegisteredUser.email;
      insertedUser.securityQuestion = newRegisteredUser.securityQuestion ?? '';
      insertedUser.securityAnswer = newRegisteredUser.securityAnswer ?? '';

      newFinanceManager = await transactionalEntityManager.save(insertedUser);
    });

    return newFinanceManager;
  }
}
