import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { OcrService } from 'src/ocr/ocr.service';
import { ClassificationService } from 'src/classification/classification.service';
import { DetectionPlateService } from 'src/detection-plate/detection-plate.service';
import { AccessStatus, VehicleType } from '@prisma/client';
import { ProcessAccessDto } from './dto/process-access.dto';

export interface ProcessAccessResult {
  access: boolean;
  message: string;
  user: string | null;
  detectedVehicle: VehicleType | null;
  detectedPlateNumber: string | null;
  accessLog: any;
}

export interface WarpTestResult {
  success: boolean;
  image: string | null;
  ocrText: string | null;
  error: string | null;
}

@Injectable()
export class AccessLogsService {
  constructor(
    private prisma: PrismaService,
    private classificationService: ClassificationService,
    private ocrService: OcrService,
    private detectionPlateService: DetectionPlateService,
  ) {}

  async processRFIDAccess(
    processAccessDto: ProcessAccessDto,
    imageBuffer?: Buffer,
  ): Promise<ProcessAccessResult> {
    const { uid } = processAccessDto;
    let detectedVehicle: VehicleType | null = null;
    let detectedPlateNumber: string | null = null;

    try {
      if (imageBuffer) {
        detectedVehicle = await this.classificationService.classifyVehicle(imageBuffer);

        if (
          detectedVehicle === VehicleType.CAR ||
          detectedVehicle === VehicleType.MOTORBIKE
        ) {
          const segResult = await this.detectionPlateService.cropPlateBySegmentation(
            imageBuffer,
          );

          if (segResult?.quad) {
            const warpOcrResult = await this.ocrService.warpAndOcr(
              segResult.buffer,
              segResult.quad,
            );

            if (warpOcrResult?.ocrText) {
              detectedPlateNumber = warpOcrResult.ocrText;
            }
          }
        }
      }

      const user = await this.prisma.user.findUnique({ where: { uid } });
      const { accessStatus, reason, userId } = this.determineAccessStatus(
        user,
        detectedVehicle ?? undefined,
        detectedPlateNumber ?? undefined,
      );

      const accessLog = await this.prisma.accessLog.create({
        data: {
          uid,
          status: accessStatus,
          userId,
          reason,
          vehicle: detectedVehicle ?? undefined,
          plateNumber: detectedPlateNumber ?? undefined,
        },
        include: { user: true },
      });

      return {
        access: accessStatus === AccessStatus.GRANTED,
        message:
          accessStatus === AccessStatus.GRANTED
            ? `Akses diberikan untuk ${user?.name}`
            : reason || 'Akses ditolak',
        user: user?.name ?? null,
        detectedVehicle: detectedVehicle ?? null,
        detectedPlateNumber: detectedPlateNumber ?? null,
        accessLog,
      };
    } catch (error) {
      return this.handleAccessError(uid, detectedVehicle, detectedPlateNumber);
    }
  }

  async findAll() {
    return this.prisma.accessLog.findMany({
      include: { user: true },
      orderBy: { timestamp: 'desc' },
    });
  }

  async findByUid(uid: string) {
    return this.prisma.accessLog.findMany({
      where: { uid },
      include: { user: true },
      orderBy: { timestamp: 'desc' },
    });
  }

  async findByDateRange(startDate: Date, endDate: Date) {
    return this.prisma.accessLog.findMany({
      where: { timestamp: { gte: startDate, lte: endDate } },
      include: { user: true },
      orderBy: { timestamp: 'desc' },
    });
  }

  async findGrantedAccess() {
    return this.prisma.accessLog.findMany({
      where: { status: AccessStatus.GRANTED },
      include: { user: true },
      orderBy: { timestamp: 'desc' },
    });
  }

  async findDeniedAccess() {
    return this.prisma.accessLog.findMany({
      where: { status: AccessStatus.DENIED },
      include: { user: true },
      orderBy: { timestamp: 'desc' },
    });
  }

  // async testClassifyVehicle(
  //   imageBuffer: Buffer,
  // ): Promise<{ vehicleType: VehicleType }> {
  //   const vehicleType = await this.classificationService.classifyVehicle(imageBuffer);
  //   return { vehicleType };
  // }

  // async testWarpPerspective(imageBuffer: Buffer): Promise<WarpTestResult> {
  //   const segResult = await this.detectionPlateService.cropPlateBySegmentation(
  //     imageBuffer,
  //   );

  //   if (!segResult) {
  //     return {
  //       success: false,
  //       image: null,
  //       ocrText: null,
  //       error: 'No plate detected',
  //     };
  //   }

  //   const { buffer: detectedPlatePng, quad } = segResult;
  //   let finalImageBase64 = `data:image/png;base64,${detectedPlatePng.toString(
  //     'base64',
  //   )}`;
  //   let ocrText: string | null = null;

  //   if (quad && quad.length === 4) {
  //     const warpOcrResult = await this.ocrService.warpAndOcr(detectedPlatePng, quad);

  //     if (warpOcrResult) {
  //       finalImageBase64 = warpOcrResult.warpedPlate;
  //       ocrText = warpOcrResult.ocrText;
  //     }
  //   }

  //   return {
  //     success: true,
  //     image: finalImageBase64,
  //     ocrText,
  //     error: null,
  //   };
  // }

  // helpers

  private determineAccessStatus(
    user: any,
    detectedVehicle?: VehicleType,
    detectedPlateNumber?: string,
  ): { accessStatus: AccessStatus; reason?: string; userId?: string } {
    if (!user) {
      return { accessStatus: AccessStatus.DENIED, reason: 'UID tidak terdaftar' };
    }

    if (!user.isActive) {
      return {
        accessStatus: AccessStatus.DENIED,
        reason: 'User tidak aktif',
        userId: user.id,
      };
    }

    if (
      !detectedVehicle ||
      detectedVehicle === VehicleType.NO_VEHICLE ||
      detectedVehicle === VehicleType.BIKE
    ) {
      return { accessStatus: AccessStatus.GRANTED, userId: user.id };
    }

    if (
      detectedVehicle === VehicleType.CAR ||
      detectedVehicle === VehicleType.MOTORBIKE
    ) {
      if (!detectedPlateNumber) {
        return {
          accessStatus: AccessStatus.DENIED,
          reason: 'Nomor plat tidak terdeteksi',
          userId: user.id,
        };
      }

      if (!user.plateNumber.includes(detectedPlateNumber)) {
        return {
          accessStatus: AccessStatus.DENIED,
          reason: 'Nomor plat tidak terdaftar',
          userId: user.id,
        };
      }
    }

    return { accessStatus: AccessStatus.GRANTED, userId: user.id };
  }

  private async handleAccessError(
    uid: string,
    detectedVehicle?: VehicleType | null,
    detectedPlateNumber?: string | null,
  ): Promise<ProcessAccessResult> {
    const errorLog = await this.prisma.accessLog.create({
      data: {
        uid,
        status: AccessStatus.DENIED,
        reason: 'System error',
        vehicle: detectedVehicle ?? undefined,
        plateNumber: detectedPlateNumber ?? undefined,
      },
    });

    return {
      access: false,
      message: 'System error',
      user: null,
      detectedVehicle: detectedVehicle ?? null,
      detectedPlateNumber: detectedPlateNumber ?? null,
      accessLog: errorLog,
    };
  }
}
