import { Injectable, UnauthorizedException, ConflictException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { LoginDto } from './dto/login.dto';
import { RegisterAdminDto } from './dto/register-operator.dto';
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

        if (user.tokenVersion >= 1) {
            throw new UnauthorizedException('This account is currently in use on another device. Please log out from that device first.');
        }

        const updateUser = await this.prisma.user.update({
            where: { id: user.id },
            data: { tokenVersion: 1 },
        });

        const payload: JwtPayload = {
            sub: updateUser.id,
            email: updateUser.email,
            pid: updateUser.pid,
            role: updateUser.role,
            name: updateUser.name,
            version: updateUser.tokenVersion,
        };

        const accessToken = this.jwtService.sign(payload);

        return {
            id: updateUser.id,
            pid: updateUser.pid,
            email: updateUser.email,
            name: updateUser.name,
            role: updateUser.role,
            access_token: accessToken,
        };
    }

    async registerAdmin(registerAdminDto: RegisterAdminDto): Promise<AuthResponseDto> {
        const { pid, email, name, password } = registerAdminDto;

        const existingUserByEmail = await this.prisma.user.findUnique({
            where: { email },
        });

        if (existingUserByEmail) {
            throw new ConflictException('Email already exists');
        }

        const existingUserByPid = await this.prisma.user.findUnique({
            where: { pid },
        });

        if (existingUserByPid) {
            throw new ConflictException('PID already exists');
        }

        const saltRounds = 10;
        const hashedPassword = await bcrypt.hash(password, saltRounds);

        const user = await this.prisma.user.create({
            data: {
                pid,
                email,
                name,
                password: hashedPassword,
                role: Role.OPERATOR,
                isActive: true,
                tokenVersion: 0,
            },
        });

        const payload: JwtPayload = {
            sub: user.id,
            email: user.email,
            pid: user.pid,
            role: user.role,
            name: user.name,
            version: user.tokenVersion,
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

    async logout(userId: string) {
        await this.prisma.user.update({
            where: { id: userId },
            data: { tokenVersion: 0 },
        });

        return { message: 'Logged out successfully' };
    }
}