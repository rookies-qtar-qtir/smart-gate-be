import { Module } from '@nestjs/common';
import { AccessLogsController } from './access-logs.controller';
import { AccessLogsService } from './access-logs.service';
import { PrismaService } from '../prisma/prisma.service';
import { TfjsModule } from '../tfjs/tfjs.module';
import { OcrModule } from 'src/ocr/ocr.module';
import { ClassificationModule } from 'src/classification/classification.module';
import { DetectionPlateModule } from 'src/detection-plate/detection-plate.module';

@Module({
  imports: [TfjsModule, OcrModule, ClassificationModule, DetectionPlateModule],
  controllers: [AccessLogsController],
  providers: [AccessLogsService, PrismaService],
  exports: [AccessLogsService,],
})
export class AccessLogsModule {}