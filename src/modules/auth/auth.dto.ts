import { IsEmail, IsEnum, IsNotEmpty } from 'class-validator';

export class LoginAttemptDTO {
  @IsEmail({}, { message: 'Email input must be a valid email' })
  @IsNotEmpty({ message: 'Email is required' })
  email: string;

  @IsNotEmpty({ message: 'Password is required' })
  password: string;
}

export class LoginResponseDTO {
  @IsNotEmpty({ message: 'Name is required' })
  name: string;

  @IsEmail({}, { message: 'Email input must be a valid email' })
  @IsNotEmpty({ message: 'Email is required' })
  email: string;

  @IsNotEmpty({ message: 'Authentication token is required' })
  authenticationToken: string;
}
