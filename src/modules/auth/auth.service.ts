import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { DataSource } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { FinanceManagerEntity } from '../../entities/finance-managers';
import { LoginAttemptDTO, LoginResponseDTO } from './auth.dto';

@Injectable()
export class AuthService {
  constructor(
    private dataSource: DataSource,
    private jwtService: JwtService,
  ) {}

  async loginAttempt(
    loginAttemptDto: LoginAttemptDTO,
  ): Promise<LoginResponseDTO> {
    const loginResponse: LoginResponseDTO = new LoginResponseDTO();

    await this.dataSource.transaction(async (transactionalEntityManager) => {
      // Check if email exists in user data, throw 409 error if user exists
      const financeManager = await transactionalEntityManager.findOne(
        FinanceManagerEntity,
        {
          where: {
            email: loginAttemptDto.email,
          },
        },
      );

      if (!financeManager) {
        throw new HttpException(
          `The entered email address ${loginAttemptDto.email} does not match any existing account.`,
          HttpStatus.NOT_FOUND,
        );
      }

      // Check if the password has been entered is match
      const isPasswordMatch = await bcrypt.compare(
        loginAttemptDto.password,
        financeManager.password,
      );

      // If password doesn't match, throw error
      if (!isPasswordMatch) {
        throw new HttpException(
          'The password you entered is incorrect. Please try again.',
          HttpStatus.NOT_ACCEPTABLE,
        );
      }

      // Generate authentication token
      const authenticationToken = await this.jwtService.signAsync({
        id: financeManager.id,
        name: financeManager.name,
        email: financeManager.email,
      });

      loginResponse.name = financeManager.name;
      loginResponse.email = financeManager.email;
      loginResponse.authenticationToken = authenticationToken;
    });

    return loginResponse;
  }
}
