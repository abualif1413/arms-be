import { IsEmail, IsNotEmpty } from 'class-validator';

export class UserDecoratorDTO {
  @IsNotEmpty({ message: 'ID is required' })
  id: string;

  @IsNotEmpty({ message: 'Name is required' })
  name: string;

  @IsEmail({}, { message: 'Email input must be a valid email' })
  @IsNotEmpty({ message: 'Email is required' })
  email: string;
}
