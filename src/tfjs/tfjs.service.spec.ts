import { Test, TestingModule } from '@nestjs/testing';
import { TfjsService } from './tfjs.service';

describe('TfjsService', () => {
  let service: TfjsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [TfjsService],
    }).compile();

    service = module.get<TfjsService>(TfjsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
