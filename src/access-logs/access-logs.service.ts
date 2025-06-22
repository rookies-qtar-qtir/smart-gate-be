import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TfjsService } from 'src/tfjs/tfjs.service';
import { AccessStatus, VehicleType } from '@prisma/client';
import { ProcessAccessDto } from './dto/process-access.dto';

@Injectable()
export class AccessLogsService {
  constructor(
    private prisma: PrismaService,
    private tfjsService: TfjsService,
  ) {}

  async processRFIDAccess(processAccessDto: ProcessAccessDto, imageBuffer?: Buffer) {
    const { uid } = processAccessDto;
    let detectedVehicle: VehicleType | null = null;
    let vehicleDetectionError: string | null = null;

    try {
      if (imageBuffer) {
        try {
          const vehicleType = await this.tfjsService.classifyVehicle(imageBuffer);
          detectedVehicle = vehicleType;
        } catch (imageError) {
          console.error('Vehicle classification failed:', imageError);
          detectedVehicle = null;
          vehicleDetectionError = 'Gagal mendeteksi kendaraan';
        }
      }

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
          vehicle: detectedVehicle,
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
        detectedVehicle,
        vehicleDetectionError,
        accessLog,
      };
    } catch (error) {
      const errorLog = await this.prisma.accessLog.create({
        data: {
          uid,
          status: AccessStatus.DENIED,
          reason: 'System error',
          vehicle: detectedVehicle,
        },
      });

      return {
        access: false,
        message: 'System error',
        user: null,
        detectedVehicle,
        vehicleDetectionError,
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
