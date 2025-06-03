import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  HttpStatus,
  Query,
} from '@nestjs/common';
import { AccessLogsService } from './access-logs.service';
import { ProcessAccessDto } from './dto/process-access.dto';

@Controller('access-logs')
export class AccessLogsController {
  constructor(private readonly accessLogsService: AccessLogsService) {}

  @Post('process')
  async processAccess(@Body() processAccessDto: ProcessAccessDto) {
    const result =
      await this.accessLogsService.processRFIDAccess(processAccessDto);

    return {
      statusCode: result.access ? HttpStatus.OK : HttpStatus.FORBIDDEN,
      message: result.message,
      data: {
        access: result.access,
        user: result.user,
        accessLog: result.accessLog,
      },
    };
  }

  @Get()
  async findAll() {
    const accessLogs = await this.accessLogsService.findAll();
    return {
      statusCode: HttpStatus.OK,
      message: 'Access logs retrieved successfully',
      data: accessLogs,
    };
  }

  @Get('uid/:uid')
  async findByUid(@Param('uid') uid: string) {
    const accessLogs = await this.accessLogsService.findByUid(uid);
    return {
      statusCode: HttpStatus.OK,
      message: 'Access logs by UID retrieved successfully',
      data: accessLogs,
    };
  }

  @Get('date-range')
  async findByDateRange(
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
  ) {
    const start = new Date(startDate);
    const end = new Date(endDate);

    end.setHours(23, 59, 59, 999);

    const accessLogs = await this.accessLogsService.findByDateRange(start, end);

    return {
      statusCode: HttpStatus.OK,
      message: 'Access logs by date range retrieved successfully',
      data: accessLogs,
    };
  }

  @Get('granted')
  async findGrantedAccess() {
    const accessLogs = await this.accessLogsService.findGrantedAccess();
    return {
      statusCode: HttpStatus.OK,
      message: 'Granted access logs retrieved successfully',
      data: accessLogs,
    };
  }

  @Get('denied')
  async findDeniedAccess() {
    const accessLogs = await this.accessLogsService.findDeniedAccess();
    return {
      statusCode: HttpStatus.OK,
      message: 'Denied access logs retrieved successfully',
      data: accessLogs,
    };
  }
}
