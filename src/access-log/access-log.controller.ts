import {
  Controller, Get, Post, Query, Body,
  BadRequestException, InternalServerErrorException,
} from '@nestjs/common';
import { AccessLogService } from './access-log.service';
import { AccessLog } from './schemas/access-log.schema';

@Controller('access-log')
export class AccessLogController {
  constructor(private readonly accessLogService: AccessLogService) { }

  @Post()
  async create(@Body() log: Partial<AccessLog>) {
    try {
      const createdLog = await this.accessLogService.create(log);
      return {
        message: 'Access log created successfully',
        data: createdLog,
      };
    } catch (err) {
      throw new InternalServerErrorException('Failed to create access log');
    }
  }

  @Get()
  async findAll() {
    try {
      const logs = await this.accessLogService.findAll();
      return logs;
    } catch (err) {
      throw new InternalServerErrorException('Failed to fetch access logs');
    }
  }

  @Get('by-uid')
  async findByUid(@Query('uid') uid: string) {
    try {
      if (!uid) throw new BadRequestException('UID is required');
      const logs = await this.accessLogService.findByUid(uid);
      return logs;
    } catch (err) {
      throw err;
    }
  }

  @Get('by-date')
  async findByDate(@Query('start') start: string, @Query('end') end: string) {
    try {
      const startDate = new Date(start);
      const endDate = new Date(end);

      if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
        throw new BadRequestException('Invalid start or end date');
      }

      const logs = await this.accessLogService.findByDate(startDate, endDate);
      return logs;
    } catch (err) {
      throw err;
    }
  }
}
