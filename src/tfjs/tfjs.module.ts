import { Module } from '@nestjs/common';
import { TfjsService } from './tfjs.service';

@Module({
  providers: [TfjsService],
  exports: [TfjsService],
})
export class TfjsModule {}
