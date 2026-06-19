// src/common/decorators/user.decorator.ts
import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

export const User = createParamDecorator(
  (data: string, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    const headers = request.headers;

    if (headers['authorization']) {
      const jwt = new JwtService();
      const authorizationHeader = headers['authorization'];
      const authToken = authorizationHeader.split(' ')[1];
      const decodedToken = jwt.decode(authToken);

      return decodedToken ?? null;
    } else {
      return null;
    }
  },
);
