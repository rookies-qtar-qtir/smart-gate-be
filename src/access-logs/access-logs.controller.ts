import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  HttpStatus,
  Query,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { AccessLogsService } from './access-logs.service';
import { ProcessAccessDto } from './dto/process-access.dto';
import { Public } from '../auth/decorators/public.decorator';
import { AdminOnly } from '../auth/decorators/admin-only.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtPayload } from '../auth/interfaces/jwt-payload.interface';

@Controller('access-logs')
export class AccessLogsController {
  private processingRequests = new Map<string, Promise<any>>();

  constructor(private readonly accessLogsService: AccessLogsService) { }

  @Public()
  @Post('process')
  @UseInterceptors(FileInterceptor('image'))
  async processAccess(
    @Body() processAccessDto: ProcessAccessDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    const { uid } = processAccessDto;

    if (this.processingRequests.has(uid)) {
      const existingPromise = this.processingRequests.get(uid);
      const result = await existingPromise;

      return {
        statusCode: result.access ? HttpStatus.OK : HttpStatus.FORBIDDEN,
        message: `${result.message} (duplicate request handled)`,
        data: {
          access: result.access,
          user: result.user,
          detectedVehicle: result.detectedVehicle,
          detectedPlateNumber: result.detectedPlateNumber,
          accessLog: result.accessLog,
        },
      };
    }

    const processingPromise = this.handleProcessAccess(processAccessDto, file?.buffer);

    this.processingRequests.set(uid, processingPromise);

    try {
      const result = await processingPromise;

      return {
        statusCode: result.access ? HttpStatus.OK : HttpStatus.FORBIDDEN,
        message: result.message,
        data: {
          access: result.access,
          user: result.user,
          detectedVehicle: result.detectedVehicle,
          detectedPlateNumber: result.detectedPlateNumber,
          accessLog: result.accessLog,
        },
      };
    } finally {
      this.processingRequests.delete(uid);
    }
  }

  @Public()
  @Post('detection')
  @UseInterceptors(FileInterceptor('image'))
  async detectPlate(@UploadedFile() file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('Image file is required');
    }

    try {
      const result = await this.accessLogsService.detectPlateInImage(file.buffer);

      return {
        statusCode: HttpStatus.OK,
        message: result.detected ? 'Plate detected successfully' : 'No plate detected',
        data: {
          detected: result.detected,
          plateDetection: result.plateDetection,
          vehicleType: result.vehicleType,
          croppedPlateImage: result.croppedPlateImage,
          ocrText: (result as any).ocrText || null,
        },
      };
    } catch (error) {
      return {
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        message: 'Detection failed',
        data: {
          detected: false,
          error: error.message,
        },
      };
    }
  }


  private async handleProcessAccess(
    processAccessDto: ProcessAccessDto,
    fileBuffer?: Buffer,
  ) {
    return await this.accessLogsService.processRFIDAccess(
      processAccessDto,
      fileBuffer,
    );
  }

  @AdminOnly()
  @Get()
  async findAll(@CurrentUser() admin: JwtPayload) {
    const accessLogs = await this.accessLogsService.findAll();
    return {
      statusCode: HttpStatus.OK,
      message: 'Access logs retrieved successfully',
      data: accessLogs,
      accessedBy: admin.email,
    };
  }

  @AdminOnly()
  @Get('uid/:uid')
  async findByUid(@Param('uid') uid: string, @CurrentUser() admin: JwtPayload) {
    const accessLogs = await this.accessLogsService.findByUid(uid);
    return {
      statusCode: HttpStatus.OK,
      message: 'Access logs by UID retrieved successfully',
      data: accessLogs,
      accessedBy: admin.email,
    };
  }

  @AdminOnly()
  @Get('date-range')
  async findByDateRange(
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
    @CurrentUser() admin: JwtPayload,
  ) {
    const start = new Date(startDate);
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);

    const accessLogs = await this.accessLogsService.findByDateRange(start, end);
    return {
      statusCode: HttpStatus.OK,
      message: 'Access logs by date range retrieved successfully',
      data: accessLogs,
      accessedBy: admin.email,
    };
  }

  @AdminOnly()
  @Get('granted')
  async findGrantedAccess(@CurrentUser() admin: JwtPayload) {
    const accessLogs = await this.accessLogsService.findGrantedAccess();
    return {
      statusCode: HttpStatus.OK,
      message: 'Granted access logs retrieved successfully',
      data: accessLogs,
      accessedBy: admin.email,
    };
  }

  @AdminOnly()
  @Get('denied')
  async findDeniedAccess(@CurrentUser() admin: JwtPayload) {
    const accessLogs = await this.accessLogsService.findDeniedAccess();
    return {
      statusCode: HttpStatus.OK,
      message: 'Denied access logs retrieved successfully',
      data: accessLogs,
      accessedBy: admin.email,
    };
  }
}