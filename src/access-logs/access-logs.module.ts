import { Module } from '@nestjs/common';
import { AccessLogsController } from './access-logs.controller';
import { AccessLogsService } from './access-logs.service';
import { PrismaService } from '../prisma/prisma.service';

@Module({
  controllers: [AccessLogsController],
  providers: [AccessLogsService, PrismaService],
  exports: [AccessLogsService],
})
export class AccessLogsModule {}