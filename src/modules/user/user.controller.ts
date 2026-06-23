import { Body, Controller, Post } from '@nestjs/common';
import { UserService } from './user.service';
import { RegisterUserDTO } from './user.dto';
import { UserEntity } from '../../entities/users';

@Controller('user')
export class UserController {
  constructor(private userService: UserService) {}

  @Post('register')
  async register(
    @Body() registerFinanceManagerDto: RegisterUserDTO,
  ): Promise<UserEntity> {
    return this.userService.register(registerFinanceManagerDto);
  }
}
