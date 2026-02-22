import { Injectable, NotFoundException, UnauthorizedException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { Prisma, Role } from '@prisma/client';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) { }

  async create(createUserDto: CreateUserDto) {
    try {
      return await this.prisma.user.create({
        data: createUserDto,
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        const target = error.meta?.target as string[];
        if (target?.includes('email')) throw new ConflictException('Email sudah terdaftar');
        if (target?.includes('pid')) throw new ConflictException('PID sudah terdaftar');
      }
      throw error;
    }
  }

  private readonly PAGE_SIZE = 10;

  async findAll(page: number = 1) {
    const skip = (page - 1) * this.PAGE_SIZE;

    const filterCondition = {
      role: Role.PENGHUNI,
    };

    const [data, total] = await Promise.all([
      this.prisma.user.findMany({
        where: filterCondition,
        orderBy: { createdAt: 'desc' },
        skip,
        take: this.PAGE_SIZE,
      }),
      this.prisma.user.count({
        where: filterCondition,
      }),
    ]);

    return {
      data,
      meta: {
        total,
        page,
        pageSize: this.PAGE_SIZE,
        totalPages: Math.ceil(total / this.PAGE_SIZE),
      },
    };
  }

  async findOperator() {
    const filterCondition = {
      role: Role.OPERATOR,
    }

    const data = await Promise.all([
      this.prisma.user.findMany({
        where: filterCondition,
        orderBy: { createdAt: 'desc'},
      }),
    ]);

    return {
      data
    }
  }

  async findOne(id: string) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException(`User with ID ${id} not found`);
    return user;
  }

  async findByPid(pid: string) {
    const user = await this.prisma.user.findUnique({ where: { pid } });
    if (!user) throw new NotFoundException(`User with PID ${pid} not found`);
    return user;
  }

  async update(id: string, updateUserDto: UpdateUserDto) {
    await this.findOne(id);
    try {
      return await this.prisma.user.update({
        where: { id },
        data: updateUserDto,
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        const target = error.meta?.target as string[];
        if (target?.includes('email')) throw new ConflictException('Email sudah terdaftar pada user lain');
        if (target?.includes('pid')) throw new ConflictException('PID sudah terdaftar pada user lain');
      }
      throw error;
    }
  }

  async remove(id: string, pin: string) {
    const validPin = process.env.PIN_DELETE;
    if (pin !== validPin) {
      throw new UnauthorizedException('PIN tidak valid');
    }
    await this.findOne(id);
    return await this.prisma.user.delete({ where: { id } });
  }
}