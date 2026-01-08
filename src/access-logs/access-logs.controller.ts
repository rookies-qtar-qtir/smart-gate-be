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
import { OperatorOnly } from '../auth/decorators/operator-only.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtPayload } from '../auth/interfaces/jwt-payload.interface';

@Controller('access-logs')
export class AccessLogsController {
  private processingRequests = new Map<string, Promise<ProcessAccessResult>>();

  constructor(private readonly accessLogsService: AccessLogsService) { }

  @Public()
  @Post('process')
  @UseInterceptors(FileInterceptor('image'))
  async processRFIDAccess(
    @Body() processAccessDto: ProcessAccessDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    const { pid } = processAccessDto;

    if (this.processingRequests.has(pid)) {
      const result = await this.processingRequests.get(pid)!;
      return this.formatAccessResponse(result, true);
    }

    const processingPromise = this.accessLogsService.processRFIDAccess(
      processAccessDto,
      file?.buffer,
    );

    this.processingRequests.set(pid, processingPromise);

    try {
      const result = await processingPromise;
      return this.formatAccessResponse(result);
    } finally {
      this.processingRequests.delete(pid);
    }
  }

  @OperatorOnly()
  @Post('manual')
  async processManualAccess(@CurrentUser() operator: JwtPayload) {
    const result = await this.accessLogsService.processManualAccess(operator.sub);

    return {
      statusCode: HttpStatus.OK,
      message: result.message,
      data: {
        ...result.accessLog,
        user: result.user,
      },
      accessedBy: operator.email,
    };
  }

  @OperatorOnly()
  @Get('summary')
  async getSummary(@CurrentUser() operator: JwtPayload) {
    const summary = await this.accessLogsService.getAccessSummary();
    return {
      statusCode: HttpStatus.OK,
      message: 'Access logs summary retrieved',
      data: summary,
      accessedBy: operator.email,
    }
  }

  @OperatorOnly()
  @Get()
  async findAll(@CurrentUser() operator: JwtPayload) {
    const accessLogs = await this.accessLogsService.findAll();
    return {
      statusCode: HttpStatus.OK,
      message: 'Access logs retrieved',
      data: accessLogs,
      accessedBy: operator.email,
    };
  }

  // test
  @Public()
  @Post('test-warp')
  @UseInterceptors(FileInterceptor('image'))
  async testWarp(@UploadedFile() file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('Image file is required');
    }

    try {
      const result: WarpTestResult = await this.accessLogsService.testWarpPerspective(file.buffer);

      return {
        statusCode: result.success ? HttpStatus.OK : HttpStatus.BAD_REQUEST,
        success: result.success,
        message: result.success
          ? 'Warp perspective test completed'
          : result.error ?? 'Warp perspective test failed',
        data: {
          image: result.image ?? null,
          processedImage: result.processedImage ?? null,
          ocrText: result.ocrText ?? null,
          error: result.error ?? null,
        },
      };
    } catch (error) {
      throw new HttpException(
        {
          success: false,
          message: 'Test warp failed',
          error: (error as Error).message,
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

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
