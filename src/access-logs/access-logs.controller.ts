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
  constructor(private readonly accessLogsService: AccessLogsService) {}

  @Public()
  @Post('process')
  @UseInterceptors(FileInterceptor('image'))
  async processAccess(
    @Body() processAccessDto: ProcessAccessDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    const result = await this.accessLogsService.processRFIDAccess(
      processAccessDto,
      file?.buffer,
    );

    return {
      statusCode: result.access ? HttpStatus.OK : HttpStatus.FORBIDDEN,
      message: result.message,
      data: {
        access: result.access,
        user: result.user,
        detectedVehicle: result.detectedVehicle,
        accessLog: result.accessLog,
      },
    };
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