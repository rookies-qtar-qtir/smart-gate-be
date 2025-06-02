import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AccessLog, AccessLogSchema } from './schemas/access-log.schema';
import { AccessLogService } from './access-log.service';
import { AccessLogController } from './access-log.controller';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: AccessLog.name, schema: AccessLogSchema }])
  ],
  controllers: [AccessLogController],
  providers: [AccessLogService],
})
export class AccessLogModule { }
