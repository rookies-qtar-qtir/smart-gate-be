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
  HttpException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { AccessLogsService, ProcessAccessResult, WarpTestResult } from './access-logs.service';
import { ProcessAccessDto } from './dto/process-access.dto';
import { Public } from '../auth/decorators/public.decorator';
import { AdminOnly } from '../auth/decorators/admin-only.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtPayload } from '../auth/interfaces/jwt-payload.interface';

@Controller('access-logs')
export class AccessLogsController {
  private processingRequests = new Map<string, Promise<ProcessAccessResult>>();

  constructor(private readonly accessLogsService: AccessLogsService) {}

  @Public()
  @Post('process')
  @UseInterceptors(FileInterceptor('image'))
  async processAccess(
    @Body() processAccessDto: ProcessAccessDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    const { uid } = processAccessDto;

    if (this.processingRequests.has(uid)) {
      const result = await this.processingRequests.get(uid)!;
      return this.formatAccessResponse(result, true);
    }

    const processingPromise = this.accessLogsService.processRFIDAccess(
      processAccessDto,
      file?.buffer,
    );

    this.processingRequests.set(uid, processingPromise);

    try {
      const result = await processingPromise;
      return this.formatAccessResponse(result);
    } finally {
      this.processingRequests.delete(uid);
    }
  }

  @AdminOnly()
  @Get()
  async findAll(@CurrentUser() admin: JwtPayload) {
    const accessLogs = await this.accessLogsService.findAll();
    return {
      statusCode: HttpStatus.OK,
      message: 'Access logs retrieved',
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
      message: 'Access logs by UID retrieved',
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
      message: 'Access logs by date range retrieved',
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
      message: 'Granted access logs retrieved',
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
      message: 'Denied access logs retrieved',
      data: accessLogs,
      accessedBy: admin.email,
    };
  }

  // @Public()
  // @Post('test-classification')
  // @UseInterceptors(FileInterceptor('image'))
  // async testClassification(@UploadedFile() file: Express.Multer.File) {
  //   if (!file) {
  //     throw new BadRequestException('Image file is required');
  //   }

  //   try {
  //     const result = await this.accessLogsService.testClassifyVehicle(file.buffer);
  //     return {
  //       statusCode: HttpStatus.OK,
  //       success: true,
  //       message: 'Vehicle classification completed',
  //       data: result,
  //     };
  //   } catch (error) {
  //     throw new HttpException(
  //       {
  //         success: false,
  //         message: 'Classification failed',
  //         error: (error as Error).message,
  //       },
  //       HttpStatus.INTERNAL_SERVER_ERROR,
  //     );
  //   }
  // }

  // @Public()
  // @Post('test-warp')
  // @UseInterceptors(FileInterceptor('image'))
  // async testWarp(@UploadedFile() file: Express.Multer.File) {
  //   if (!file) {
  //     throw new BadRequestException('Image file is required');
  //   }

  //   try {
  //     const result: WarpTestResult = await this.accessLogsService.testWarpPerspective(
  //       file.buffer,
  //     );

  //     return {
  //       statusCode: result.success ? HttpStatus.OK : HttpStatus.BAD_REQUEST,
  //       success: result.success,
  //       message: result.success
  //         ? 'Warp perspective test completed'
  //         : result.error ?? 'Warp perspective test failed',
  //       data: {
  //         image: result.image ?? null,
  //         ocrText: result.ocrText ?? null,
  //         error: result.error ?? null,
  //       },
  //     };
  //   } catch (error) {
  //     throw new HttpException(
  //       {
  //         success: false,
  //         message: 'Test warp failed',
  //         error: (error as Error).message,
  //       },
  //       HttpStatus.INTERNAL_SERVER_ERROR,
  //     );
  //   }
  // }

  // helpers

  private formatAccessResponse(
    result: ProcessAccessResult,
    isDuplicate = false,
  ) {
    return {
      statusCode: result.access ? HttpStatus.OK : HttpStatus.FORBIDDEN,
      message: isDuplicate ? `${result.message} (duplicate request)` : result.message,
      data: {
        access: result.access,
        user: result.user,
        detectedVehicle: result.detectedVehicle,
        detectedPlateNumber: result.detectedPlateNumber,
        accessLog: result.accessLog,
      },
    };
  }
}
