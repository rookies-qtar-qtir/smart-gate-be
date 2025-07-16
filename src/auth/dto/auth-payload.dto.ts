import { Role } from '@prisma/client';

export class AuthResponseDto {
    sub: string;
    email: string;
    uid: string;
    role: Role;
    iat?: number;
    exp?: number;
}