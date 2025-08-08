import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TfjsService } from 'src/tfjs/tfjs.service';
import { OcrService } from 'src/ocr/ocr.service';
import { AccessStatus, VehicleType } from '@prisma/client';
import { ProcessAccessDto } from './dto/process-access.dto';

interface PlateDetectionResult {
  detected: boolean;
  plateDetection?: {
    bbox: {
      x: number;
      y: number;
      width: number;
      height: number;
    };
    confidence: number;
    class: string;
  };
  vehicleType?: VehicleType;
  croppedPlateImage?: string;
  ocrText?: string;
  error?: string;
}

@Injectable()
export class AccessLogsService {
  constructor(
    private prisma: PrismaService,
    private tfjsService: TfjsService,
    private ocrService: OcrService,
  ) { }

  async processRFIDAccess(processAccessDto: ProcessAccessDto, imageBuffer?: Buffer) {
    const { uid } = processAccessDto;
    let detectedVehicle: VehicleType | null = null;
    let vehicleDetectionError: string | null = null;
    let detectedPlateNumber: string | null = null;

    try {
      if (imageBuffer) {
        try {
          const vehicleType = await this.tfjsService.classifyVehicle(imageBuffer);
          detectedVehicle = vehicleType;

          if (vehicleType === VehicleType.CAR || vehicleType === VehicleType.BIKE) {
            try {
              const plateDetection = await this.tfjsService.detectPlate(imageBuffer);

              if (plateDetection) {
                try {
                  const ocrResult = await this.ocrService.cropAndRunOCR(imageBuffer, plateDetection.bbox);
                  detectedPlateNumber = ocrResult.ocrText || null;
                } catch (ocrError) {
                  console.error('OCR failed:', ocrError);
                }
              }
            } catch (plateError) {
              console.error('Plate detection failed:', plateError);
            }
          }
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
        if (detectedVehicle === VehicleType.NO_VEHICLE || !detectedVehicle) {
          accessStatus = AccessStatus.GRANTED;
          userId = user.id;
        } else if (detectedVehicle === VehicleType.CAR || detectedVehicle === VehicleType.BIKE) {
          if (!detectedPlateNumber) {
            accessStatus = AccessStatus.DENIED;
            reason = 'Nomor plat tidak terdeteksi';
            userId = user.id;
          } else if (!user.plateNumber.includes(detectedPlateNumber)) {
            accessStatus = AccessStatus.DENIED;
            reason = 'Nomor plat tidak terdaftar untuk user ini';
            userId = user.id;
          } else {
            accessStatus = AccessStatus.GRANTED;
            userId = user.id;
          }
        } else {
          accessStatus = AccessStatus.GRANTED;
          userId = user.id;
        }
      }

      const accessLog = await this.prisma.accessLog.create({
        data: {
          uid,
          userId,
          status: accessStatus,
          reason,
          vehicle: detectedVehicle,
          plateNumber: detectedPlateNumber,
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
        detectedPlateNumber,
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
          plateNumber: detectedPlateNumber,
        },
      });

      return {
        access: false,
        message: 'System error',
        user: null,
        detectedVehicle,
        detectedPlateNumber,
        vehicleDetectionError,
        accessLog: errorLog,
      };
    }
  }

  async detectPlateInImage(imageBuffer: Buffer): Promise<PlateDetectionResult> {
    try {
      const plateDetection = await this.tfjsService.detectPlate(imageBuffer);

      if (!plateDetection) return { detected: false };

      let croppedPlateImage: string | undefined;
      let ocrText: string | undefined;

      try {
        const ocrResult = await this.ocrService.cropAndRunOCR(imageBuffer, plateDetection.bbox);
        croppedPlateImage = ocrResult.croppedImage;
        ocrText = ocrResult.ocrText || undefined;
      } catch (cropError) {
        console.error('Failed to crop plate image and run OCR:', cropError);
      }

      let vehicleType: VehicleType | undefined;
      try {
        vehicleType = await this.tfjsService.classifyVehicle(imageBuffer);
      } catch (vehicleError) {
        console.error('Vehicle classification failed during detection:', vehicleError);
      }

      return {
        detected: true,
        plateDetection,
        vehicleType,
        croppedPlateImage,
        ...(ocrText ? { ocrText } : {}),
      };

    } catch (error) {
      console.error('Plate detection failed:', error);
      return {
        detected: false,
        error: error.message,
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