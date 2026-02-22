import { Role } from '@prisma/client';

export interface JwtPayload {
  sub: string;
  email: string;
  pid: string;
  role: Role;
  name: string;
  version: number;
  iat?: number;
  exp?: number;
}