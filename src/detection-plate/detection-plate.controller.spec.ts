import { Test, TestingModule } from '@nestjs/testing';
import { DetectionPlateController } from './detection-plate.controller';

describe('DetectionPlateController', () => {
  let controller: DetectionPlateController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [DetectionPlateController],
    }).compile();

    controller = module.get<DetectionPlateController>(DetectionPlateController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
