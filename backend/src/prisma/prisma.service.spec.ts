import { PrismaService } from './prisma.service';

// Mock PrismaClient itself to avoid real DB calls
const mockConnect = jest.fn().mockResolvedValue(undefined);
const mockDisconnect = jest.fn().mockResolvedValue(undefined);

jest.mock('@prisma/client', () => {
  // Use a regular function (not arrow) so 'this' refers to the new instance.
  // Returning a plain object from a constructor replaces 'this' and loses
  // the subclass prototype chain — assigning to 'this' preserves it.
  return {
    PrismaClient: jest.fn().mockImplementation(function (this: any) {
      this.$connect = mockConnect;
      this.$disconnect = mockDisconnect;
    }),
  };
});

describe('PrismaService', () => {
  let service: PrismaService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new PrismaService();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('onModuleInit() calls $connect()', async () => {
    await service.onModuleInit();
    expect(mockConnect).toHaveBeenCalledTimes(1);
  });

  it('onModuleDestroy() calls $disconnect()', async () => {
    await service.onModuleDestroy();
    expect(mockDisconnect).toHaveBeenCalledTimes(1);
  });

});
