import { Test, TestingModule } from '@nestjs/testing';
import { InternalController } from './internal.controller';
import { InternalService } from './internal.service';
import { ConfigService } from '@nestjs/config';
import { UnauthorizedException } from '@nestjs/common';
import { CreateOrganizationDto } from './dto/create-organization.dto';

describe('InternalController', () => {
  let controller: InternalController;
  let internalService: InternalService;
  let configService: ConfigService;

  const mockInternalService = {
    createOrganizationWithAdmin: jest.fn(),
  };

  const mockConfigService = {
    get: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [InternalController],
      providers: [
        {
          provide: InternalService,
          useValue: mockInternalService,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    controller = module.get<InternalController>(InternalController);
    internalService = module.get<InternalService>(InternalService);
    configService = module.get<ConfigService>(ConfigService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('createOrganizationWithAdmin', () => {
    const dto: CreateOrganizationDto = {
      orgName: 'Test Corp',
      userName: 'Admin',
      userEmail: 'admin@test.com',
      userPassword: 'password',
      masterKey: 'correct-key',
    };

    it('should call service when master key is correct', async () => {
      mockConfigService.get.mockReturnValue('correct-key');
      mockInternalService.createOrganizationWithAdmin.mockResolvedValue({ success: true });

      const result = await controller.createOrganizationWithAdmin(dto);

      expect(configService.get).toHaveBeenCalledWith('MASTER_SECRET_KEY');
      expect(internalService.createOrganizationWithAdmin).toHaveBeenCalledWith(dto);
      expect(result).toEqual({ success: true });
    });

    it('should handle master key with whitespace trimming', async () => {
      mockConfigService.get.mockReturnValue('correct-key');
      const dtoWithSpaces = { ...dto, masterKey: '  correct-key  ' };
      mockInternalService.createOrganizationWithAdmin.mockResolvedValue({ success: true });

      await controller.createOrganizationWithAdmin(dtoWithSpaces);

      expect(internalService.createOrganizationWithAdmin).toHaveBeenCalledWith(dtoWithSpaces);
    });

    it('should throw UnauthorizedException when master key is incorrect', async () => {
      mockConfigService.get.mockReturnValue('correct-key');
      const invalidDto = { ...dto, masterKey: 'wrong-key' };

      await expect(controller.createOrganizationWithAdmin(invalidDto))
        .rejects
        .toThrow(UnauthorizedException);
        
      expect(internalService.createOrganizationWithAdmin).not.toHaveBeenCalled();
    });

    it('should throw UnauthorizedException when master key is not configured in env', async () => {
      mockConfigService.get.mockReturnValue(undefined);

      await expect(controller.createOrganizationWithAdmin(dto))
        .rejects
        .toThrow(UnauthorizedException);
        
      expect(internalService.createOrganizationWithAdmin).not.toHaveBeenCalled();
    });
  });
});
