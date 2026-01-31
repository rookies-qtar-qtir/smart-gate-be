import { Test, TestingModule } from '@nestjs/testing';
import { AccessLogsService } from './access-logs.service';
import { PrismaService } from '../prisma/prisma.service';
import { OcrService } from 'src/ocr/ocr.service';
import { ClassificationService } from 'src/classification/classification.service';
import { DetectionPlateService } from 'src/detection-plate/detection-plate.service';
import { AccessStatus, VehicleType } from '@prisma/client';

describe('AccessLogsService', () => {
  let service: AccessLogsService;

  const prismaMock = {
    user: {
      findUnique: jest.fn(),
    },
    accessLog: {
      create: jest.fn(),
      count: jest.fn(),
    },
  };

  const classificationMock = {
    classifyVehicle: jest.fn(),
  };

  const ocrMock = {
    warpAndOcr: jest.fn(),
  };

  const detectionPlateMock = {
    cropPlateBySegmentation: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AccessLogsService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: ClassificationService, useValue: classificationMock },
        { provide: OcrService, useValue: ocrMock },
        { provide: DetectionPlateService, useValue: detectionPlateMock },
      ],
    }).compile();

    service = module.get(AccessLogsService);
  });

  describe('processRFIDAccess', () => {
    it('DENIED jika PID tidak terdaftar', async () => {
      prismaMock.user.findUnique.mockResolvedValue(null);

      prismaMock.accessLog.create.mockResolvedValue({
        id: 'log1',
        pid: '123',
        status: AccessStatus.DENIED,
        reason: 'PID tidak terdaftar',
        user: null,
      });

      const result = await service.processRFIDAccess({ pid: '123' } as any);

      expect(prismaMock.user.findUnique).toHaveBeenCalledWith({ where: { pid: '123' } });
      expect(result.access).toBe(false);
      expect(result.message).toBe('PID tidak terdaftar');
      expect(result.user).toBeNull();

      expect(classificationMock.classifyVehicle).not.toHaveBeenCalled();
      expect(detectionPlateMock.cropPlateBySegmentation).not.toHaveBeenCalled();
      expect(ocrMock.warpAndOcr).not.toHaveBeenCalled();
    });

    it('GRANTED jika user aktif & tanpa imageBuffer', async () => {
      prismaMock.user.findUnique.mockResolvedValue({
        id: 'u1',
        pid: '123',
        name: 'Budi',
        isActive: true,
        plateNumber: ['H1234AB'],
      });

      prismaMock.accessLog.create.mockResolvedValue({
        id: 'log1',
        pid: '123',
        status: AccessStatus.GRANTED,
        reason: null,
        user: { name: 'Budi' },
      });

      const result = await service.processRFIDAccess({ pid: '123' } as any);

      expect(classificationMock.classifyVehicle).not.toHaveBeenCalled();
      expect(detectionPlateMock.cropPlateBySegmentation).not.toHaveBeenCalled();
      expect(ocrMock.warpAndOcr).not.toHaveBeenCalled();

      expect(prismaMock.accessLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            pid: '123',
            status: AccessStatus.GRANTED,
            userId: 'u1',
          }),
          include: { user: true },
        }),
      );

      expect(result.access).toBe(true);
      expect(result.user).toBe('Budi');
      expect(result.message).toContain('Akses diberikan');
    });

    it('GRANTED jika vehicle=CAR & plat terdeteksi dan cocok dengan user.plateNumber', async () => {
      const imageBuffer = Buffer.from('dummy-image');

      classificationMock.classifyVehicle.mockResolvedValue(VehicleType.CAR);

      detectionPlateMock.cropPlateBySegmentation.mockResolvedValue({
        buffer: Buffer.from('detected-plate-png'),
        quad: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 0, y: 1 }],
      });

      ocrMock.warpAndOcr.mockResolvedValue({
        warpedPlate: 'data:image/png;base64,AAA',
        ocrText: 'H1234AB',
      });

      prismaMock.user.findUnique.mockResolvedValue({
        id: 'u1',
        pid: '123',
        name: 'Budi',
        isActive: true,
        plateNumber: ['H1234AB', 'H9999ZZ'],
      });

      prismaMock.accessLog.create.mockResolvedValue({
        id: 'log1',
        pid: '123',
        status: AccessStatus.GRANTED,
        reason: null,
        vehicle: VehicleType.CAR,
        plateNumber: 'H1234AB',
        user: { name: 'Budi' },
      });

      const result = await service.processRFIDAccess({ pid: '123' } as any, imageBuffer);

      expect(classificationMock.classifyVehicle).toHaveBeenCalledWith(imageBuffer);
      expect(detectionPlateMock.cropPlateBySegmentation).toHaveBeenCalledWith(imageBuffer);
      expect(ocrMock.warpAndOcr).toHaveBeenCalled();

      expect(result.access).toBe(true);
      expect(result.detectedVehicle).toBe(VehicleType.CAR);
      expect(result.detectedPlateNumber).toBe('H1234AB');
      expect(result.user).toBe('Budi');
    });

    it('DENIED jika vehicle=CAR tapi OCR tidak menghasilkan plat', async () => {
      const imageBuffer = Buffer.from('dummy-image');

      classificationMock.classifyVehicle.mockResolvedValue(VehicleType.CAR);

      detectionPlateMock.cropPlateBySegmentation.mockResolvedValue({
        buffer: Buffer.from('detected-plate-png'),
        quad: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 0, y: 1 }],
      });

      ocrMock.warpAndOcr.mockResolvedValue({
        warpedPlate: 'data:image/png;base64,AAA',
        ocrText: null,
      });

      prismaMock.user.findUnique.mockResolvedValue({
        id: 'u1',
        pid: '123',
        name: 'Budi',
        isActive: true,
        plateNumber: ['H1234AB'],
      });

      prismaMock.accessLog.create.mockResolvedValue({
        id: 'log1',
        pid: '123',
        status: AccessStatus.DENIED,
        reason: 'Nomor plat tidak terdeteksi',
        user: { name: 'Budi' },
      });

      const result = await service.processRFIDAccess({ pid: '123' } as any, imageBuffer);

      expect(result.access).toBe(false);
      expect(result.message).toBe('Nomor plat tidak terdeteksi');
      expect(result.detectedVehicle).toBe(VehicleType.CAR);
      expect(result.detectedPlateNumber).toBeNull();
    });

    it('Jika ada error, buat log DENIED "System error"', async () => {
      prismaMock.user.findUnique.mockRejectedValue(new Error('DB down'));

      prismaMock.accessLog.create.mockResolvedValue({
        id: 'log_err',
        pid: '123',
        status: AccessStatus.DENIED,
        reason: 'System error',
      });

      const result = await service.processRFIDAccess({ pid: '123' } as any);

      expect(prismaMock.accessLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            pid: '123',
            status: AccessStatus.DENIED,
            reason: 'System error',
          }),
        }),
      );

      expect(result.access).toBe(false);
      expect(result.message).toBe('System error');
      expect(result.user).toBeNull();
    });
  });

  describe('getAccessSummary', () => {
    it('mengembalikan total/granted/denied dari prisma.count', async () => {
      prismaMock.accessLog.count
        .mockResolvedValueOnce(100)
        .mockResolvedValueOnce(60)
        .mockResolvedValueOnce(40);

      const result = await service.getAccessSummary();

      expect(result).toEqual({ total: 100, granted: 60, denied: 40 });

      expect(prismaMock.accessLog.count).toHaveBeenCalledTimes(3);
      expect(prismaMock.accessLog.count).toHaveBeenNthCalledWith(1);
      expect(prismaMock.accessLog.count).toHaveBeenNthCalledWith(2, {
        where: { status: AccessStatus.GRANTED },
      });
      expect(prismaMock.accessLog.count).toHaveBeenNthCalledWith(3, {
        where: { status: AccessStatus.DENIED },
      });
    });
  });
});
