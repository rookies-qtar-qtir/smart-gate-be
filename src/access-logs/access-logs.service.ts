import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AccessStatus } from '@prisma/client';
import { ProcessAccessDto } from './dto/process-access.dto';

@Injectable()
export class AccessLogsService {
  constructor(private prisma: PrismaService) {}

  async processRFIDAccess(processAccessDto: ProcessAccessDto) {
    const { uid } = processAccessDto;

    try {
      const user = await this.prisma.user.findUnique({
        where: { uid },
      });

      let accessStatus: AccessStatus;
      let reason: string | null = null;
      let userId: string | null = null;

      if (!user) {
        accessStatus = AccessStatus.DENIED;
        reason = 'UID tidak terdaftar';
      } else if (!user.isActive) {
        accessStatus = AccessStatus.DENIED;
        reason = 'User tidak aktif';
        userId = user.id;
      } else {
        accessStatus = AccessStatus.GRANTED;
        userId = user.id;
      }

      const accessLog = await this.prisma.accessLog.create({
        data: {
          uid,
          userId,
          status: accessStatus,
          reason,
        },
        include: {
          user: true,
        },
      });

      return {
        access: accessStatus === AccessStatus.GRANTED,
        message:
          accessStatus === AccessStatus.GRANTED
            ? `Akses diberikan untuk ${user?.name}`
            : reason,
        user: user?.name || null,
        accessLog,
      };
    } catch (error) {
      const errorLog = await this.prisma.accessLog.create({
        data: {
          uid,
          status: AccessStatus.DENIED,
          reason: 'System error',
        },
      });

      return {
        access: false,
        message: 'System error',
        user: null,
        accessLog: errorLog,
      };
    }
  }

  async findAll() {
    return await this.prisma.accessLog.findMany({
      include: { user: true },
      orderBy: { timestamp: 'desc' },
    });
  }

  async findByUid(uid: string) {
    return await this.prisma.accessLog.findMany({
      where: { uid },
      include: { user: true },
      orderBy: { timestamp: 'desc' },
    });
  }

  async findByDateRange(startDate: Date, endDate: Date,) {
    return await this.prisma.accessLog.findMany({
      where: {
        timestamp: {
          gte: startDate,
          lte: endDate,
        },
      },
      include: { user: true },
      orderBy: { timestamp: 'desc' },
    });
  }

  async findGrantedAccess() {
    return await this.prisma.accessLog.findMany({
      where: { status: AccessStatus.GRANTED },
      include: { user: true },
      orderBy: { timestamp: 'desc' },
    });
  }

  async findDeniedAccess() {
    return await this.prisma.accessLog.findMany({
      where: { status: AccessStatus.DENIED },
      include: { user: true },
      orderBy: { timestamp: 'desc' },
    });
  }
}
