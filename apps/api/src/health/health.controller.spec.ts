import { Test, TestingModule } from '@nestjs/testing';
import { HealthController } from './health.controller';

describe('HealthController', () => {
  let controller: HealthController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
    }).compile();

    controller = module.get<HealthController>(HealthController);
  });

  it('bayad defined bashad', () => {
    expect(controller).toBeDefined();
  });

  describe('check()', () => {
    it('bayad status ok bargardone', () => {
      const result = controller.check();
      expect(result.status).toBe('ok');
    });

    it('bayad timestamp valid ISO string bargardone', () => {
      const result = controller.check();
      expect(result.timestamp).toBeDefined();
      const parsed = new Date(result.timestamp);
      expect(parsed).toBeInstanceOf(Date);
      expect(isNaN(parsed.getTime())).toBe(false);
      expect(result.timestamp).toBe(parsed.toISOString());
    });

    it('bayad har bar timestamp feli ro bargardone', () => {
      const before = Date.now();
      const result = controller.check();
      const after = Date.now();
      const resultTime = new Date(result.timestamp).getTime();
      expect(resultTime).toBeGreaterThanOrEqual(before);
      expect(resultTime).toBeLessThanOrEqual(after);
    });
  });
});
