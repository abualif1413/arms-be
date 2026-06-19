import { Body, Controller, Post } from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginAttemptDTO, LoginResponseDTO } from './auth.dto';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('login-attempt')
  async loginAttempt(
    @Body() loginAttemptDto: LoginAttemptDTO,
  ): Promise<LoginResponseDTO> {
    return this.authService.loginAttempt(loginAttemptDto);
  }
}
