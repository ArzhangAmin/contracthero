import { Test, TestingModule } from '@nestjs/testing';

const mockConnect = jest.fn().mockResolvedValue(undefined);
const mockDisconnect = jest.fn().mockResolvedValue(undefined);

// Mock PrismaClient ta niyaz be generated client nabashe
jest.mock('@prisma/client', () => {
  class MockPrismaClient {
    $connect = mockConnect;
    $disconnect = mockDisconnect;
  }
  return { PrismaClient: MockPrismaClient };
});

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { PrismaService } = require('./prisma.service') as typeof import('./prisma.service');

describe('PrismaService', () => {
  let service: InstanceType<typeof PrismaService>;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [PrismaService],
    }).compile();

    service = module.get(PrismaService);
  });

  it('bayad service create beshe', () => {
    expect(service).toBeDefined();
  });

  it('bayad $connect ro dar onModuleInit call kone', async () => {
    await service.onModuleInit();

    expect(mockConnect).toHaveBeenCalledTimes(1);
  });

  it('bayad $disconnect ro dar onModuleDestroy call kone', async () => {
    await service.onModuleDestroy();

    expect(mockDisconnect).toHaveBeenCalledTimes(1);
  });

  it('bayad onModuleInit va onModuleDestroy implement kone', () => {
    expect(typeof service.onModuleInit).toBe('function');
    expect(typeof service.onModuleDestroy).toBe('function');
  });
});
