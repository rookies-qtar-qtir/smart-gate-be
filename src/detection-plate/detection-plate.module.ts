import { Module } from '@nestjs/common';
import { DetectionPlateService } from './detection-plate.service';
import { DetectionPlateController } from './detection-plate.controller';

@Module({
  providers: [DetectionPlateService],
  exports: [DetectionPlateService],
  controllers: [DetectionPlateController],
})
export class DetectionPlateModule {}
