import { registerAs } from '@nestjs/config';

export default registerAs('jwt', () => {
  return {
    secret: process.env.JWT_SECRET,
    signOptions: {
      audience: process.env.JWT_TOKEN_AUDIENCE,
      issuer: process.env.JWT_TOKEN_ISSUER,
    },
    verifyOptions: {
      audience: process.env.JWT_TOKEN_AUDIENCE,
      issuer: process.env.JWT_TOKEN_ISSUER,
    },
  };
});
