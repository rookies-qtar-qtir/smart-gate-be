import { Module } from '@nestjs/common';
import { AccessLogsController } from './access-logs.controller';
import { AccessLogsService } from './access-logs.service';
import { PrismaService } from '../prisma/prisma.service';
import { TfjsModule } from '../tfjs/tfjs.module';
import { OnnxModule } from '../onnx/onnx.module';
import { OcrModule } from 'src/ocr/ocr.module';

@Module({
  imports: [TfjsModule, OnnxModule, OcrModule],
  controllers: [AccessLogsController],
  providers: [AccessLogsService, PrismaService],
  exports: [AccessLogsService],
})
export class AccessLogsModule {}