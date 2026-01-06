import { Injectable, UnauthorizedException, ConflictException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { LoginDto } from './dto/login.dto';
// import { RegisterAdminDto } from './dto/register-operator.dto';
import { AuthResponseDto } from './dto/auth-response.dto';
import { JwtPayload } from './interfaces/jwt-payload.interface';
import { Role } from '@prisma/client';
import * as bcrypt from 'bcrypt';

@Injectable()
export class AuthService {
    constructor(
        private prisma: PrismaService,
        private jwtService: JwtService,
    ) { }

    async login(loginDto: LoginDto): Promise<AuthResponseDto> {
        const { email, password } = loginDto;

        const user = await this.prisma.user.findUnique({
            where: { email },
        });

        if (!user) {
            throw new UnauthorizedException('Invalid credentials');
        }

        if (!user.isActive) {
            throw new UnauthorizedException('User account is inactive');
        }

        if (user.role !== Role.OPERATOR) {
            throw new UnauthorizedException('Operator access required');
        }

        if (!user.password) {
            throw new UnauthorizedException('Password not set for this user');
        }

        const isPasswordValid = await bcrypt.compare(password, user.password);
        if (!isPasswordValid) {
            throw new UnauthorizedException('Invalid credentials');
        }

        const payload: JwtPayload = {
            sub: user.id,
            email: user.email,
            pid: user.pid,
            role: user.role,
            name: user.name,
        };

        const accessToken = this.jwtService.sign(payload);

        return {
            id: user.id,
            pid: user.pid,
            email: user.email,
            name: user.name,
            role: user.role,
            access_token: accessToken,
        };
    }

    // async registerAdmin(registerAdminDto: RegisterAdminDto): Promise<AuthResponseDto> {
    //     const { pid, email, name, password } = registerAdminDto;

    //     const existingUserByEmail = await this.prisma.user.findUnique({
    //         where: { email },
    //     });

    //     if (existingUserByEmail) {
    //         throw new ConflictException('Email already exists');
    //     }

    //     const existingUserByPid = await this.prisma.user.findUnique({
    //         where: { pid },
    //     });

    //     if (existingUserByPid) {
    //         throw new ConflictException('PID already exists');
    //     }

    //     const saltRounds = 10;
    //     const hashedPassword = await bcrypt.hash(password, saltRounds);

    //     const user = await this.prisma.user.create({
    //         data: {
    //             pid,
    //             email,
    //             name,
    //             password: hashedPassword,
    //             role: Role.OPERATOR,
    //             isActive: true,
    //         },
    //     });

    //     const payload: JwtPayload = {
    //         sub: user.id,
    //         email: user.email,
    //         pid: user.pid,
    //         role: user.role,
    //         name: user.name,
    //     };

    //     const accessToken = this.jwtService.sign(payload);

    //     return {
    //         id: user.id,
    //         pid: user.pid,
    //         email: user.email,
    //         name: user.name,
    //         role: user.role,
    //         access_token: accessToken,
    //     };
    // }
}