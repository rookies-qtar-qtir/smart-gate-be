import { Role } from '@prisma/client';

export class AuthResponseDto {
    id: string;
    pid: string;
    email: string;
    name: string;
    role: Role;
    access_token: string;
}