import { Module } from '@nestjs/common';
import { OnnxService } from './onnx.service';

@Module({
  providers: [OnnxService],
  exports: [OnnxService],
})
export class OnnxModule {}
