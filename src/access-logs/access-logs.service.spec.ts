import { Test, TestingModule } from '@nestjs/testing';
import { AccessLogsService } from './access-logs.service';

describe('AccessLogsService', () => {
  let service: AccessLogsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [AccessLogsService],
    }).compile();

    service = module.get<AccessLogsService>(AccessLogsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
