import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { DataSource } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { UserEntity } from '../../entities/users';
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
      const user = await transactionalEntityManager.findOne(UserEntity, {
        where: {
          email: loginAttemptDto.email,
        },
      });

      if (!user) {
        throw new HttpException(
          `The entered email address ${loginAttemptDto.email} does not match any existing account.`,
          HttpStatus.NOT_FOUND,
        );
      }

      // Check if the password has been entered is match
      const isPasswordMatch = await bcrypt.compare(
        loginAttemptDto.password,
        user.password,
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
        id: user.id,
        name: user.name,
        email: user.email,
      });

      loginResponse.name = user.name;
      loginResponse.email = user.email;
      loginResponse.authenticationToken = authenticationToken;
    });

    return loginResponse;
  }
}
