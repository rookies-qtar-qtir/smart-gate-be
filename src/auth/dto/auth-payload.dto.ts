import { Role } from '@prisma/client';

export class AuthResponseDto {
    sub: string;
    email: string;
    pid: string;
    role: Role;
    iat?: number;
    exp?: number;
}