import { Test, TestingModule } from '@nestjs/testing';
import { OnnxService } from './onnx.service';

describe('OnnxService', () => {
  let service: OnnxService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [OnnxService],
    }).compile();

    service = module.get<OnnxService>(OnnxService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
