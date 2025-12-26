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
  processedImage: string | null;
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
  ) { }

  async processRFIDAccess(
    processAccessDto: ProcessAccessDto,
    imageBuffer?: Buffer,
  ): Promise<ProcessAccessResult> {
    const { pid } = processAccessDto;
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

      const user = await this.prisma.user.findUnique({ where: { pid } });
      const { accessStatus, reason, userId } = this.determineAccessStatus(
        user,
        detectedVehicle ?? undefined,
        detectedPlateNumber ?? undefined,
      );

      const accessLog = await this.prisma.accessLog.create({
        data: {
          pid,
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
      return this.handleAccessError(pid, detectedVehicle, detectedPlateNumber);
    }
  }

  async getAccessSummary() {
    const [total, granted, denied] = await Promise.all([
      this.prisma.accessLog.count(),
      this.prisma.accessLog.count({
        where: { status: AccessStatus.GRANTED }
      }),
      this.prisma.accessLog.count({
        where: { status: AccessStatus.DENIED }
      }),
    ]);

    return {
      total,
      granted,
      denied,
    };
  }

  async findAll() {
    return this.prisma.accessLog.findMany({
      include: { user: true },
      orderBy: { timestamp: 'desc' },
    });
  }

  // test

  async testWarpPerspective(imageBuffer: Buffer): Promise<WarpTestResult> {
    const segResult = await this.detectionPlateService.cropPlateBySegmentation(imageBuffer);

    if (!segResult) {
      return {
        success: false,
        image: null,
        processedImage: null,
        ocrText: null,
        error: 'No plate detected',
      }
    }

    const { buffer: detectedPlatePng, quad } = segResult;
    let finalImageBase64 = `data:image/png;base64,${detectedPlatePng.toString('base64')}`;

    let ocrText: string | null = null;
    let processedImage: string | null = null;

    if (quad && quad.length === 4) {
      const warpOcrResult = await this.ocrService.warpAndOcr(detectedPlatePng, quad);

      if (warpOcrResult) {
        finalImageBase64 = warpOcrResult.warpedPlate;
        ocrText = warpOcrResult.ocrText;
        processedImage = warpOcrResult.processedPlate || null;
      }
    }

    return {
      success: true,
      image: finalImageBase64,
      processedImage: processedImage,
      ocrText,
      error: null,
    }
  }

  // helpers

  private determineAccessStatus(
    user: any,
    detectedVehicle?: VehicleType,
    detectedPlateNumber?: string,
  ): { accessStatus: AccessStatus; reason?: string; userId?: string } {
    if (!user) {
      return { accessStatus: AccessStatus.DENIED, reason: 'PID tidak terdaftar' };
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
    pid: string,
    detectedVehicle?: VehicleType | null,
    detectedPlateNumber?: string | null,
  ): Promise<ProcessAccessResult> {
    const errorLog = await this.prisma.accessLog.create({
      data: {
        pid,
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
