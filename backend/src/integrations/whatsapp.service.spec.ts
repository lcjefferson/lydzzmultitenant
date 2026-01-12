
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { WhatsAppService } from './whatsapp.service';
import axios from 'axios';

jest.mock('axios');
const mockedAxios = axios as any;

describe('WhatsAppService (Official API)', () => {
  let service: WhatsAppService;
  let configService: ConfigService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WhatsAppService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              if (key === 'WHATSAPP_API_URL') return 'https://graph.facebook.com/v18.0';
              return null;
            }),
          },
        },
      ],
    }).compile();

    service = module.get<WhatsAppService>(WhatsAppService);
    configService = module.get<ConfigService>(ConfigService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('sendMessage', () => {
    it('should send a text message successfully', async () => {
      mockedAxios.post.mockResolvedValue({
        data: {
          messages: [{ id: 'wamid.HBgNM...' }]
        }
      });

      const result = await service.sendMessage(
        '5511999999999',
        'Hello World',
        '123456789',
        'access_token_xyz'
      );

      expect(result.success).toBe(true);
      expect(mockedAxios.post).toHaveBeenCalledWith(
        'https://graph.facebook.com/v18.0/123456789/messages',
        {
          messaging_product: 'whatsapp',
          to: '5511999999999',
          type: 'text',
          text: { body: 'Hello World' }
        },
        expect.any(Object)
      );
    });

    it('should auto-format Brazilian numbers (add 55)', async () => {
      mockedAxios.post.mockResolvedValue({ data: { messages: [{ id: '123' }] } });

      await service.sendMessage(
        '11999999999', // 11 digits
        'Test',
        '123',
        'token'
      );

      expect(mockedAxios.post).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          to: '5511999999999'
        }),
        expect.any(Object)
      );
    });

    it('should handle API errors gracefully', async () => {
        const errorResponse = {
            response: {
                status: 400,
                data: {
                    error: {
                        message: 'Invalid parameter',
                        type: 'OAuthException',
                        code: 100,
                        error_subcode: 1234567,
                        fbtrace_id: 'Ag...'
                    }
                }
            },
            isAxiosError: true
        };
        // @ts-ignore
        mockedAxios.post.mockRejectedValue(errorResponse);
        // @ts-ignore
        mockedAxios.isAxiosError.mockReturnValue(true);

        const result = await service.sendMessage('123', 'msg', 'pid', 'token');
        
        expect(result.success).toBe(false);
        expect(result.error).toContain('Status: 400');
    });
  });

  describe('Webhook Parsing', () => {
      it('should parse a standard text message payload', () => {
          const payload = {
            object: 'whatsapp_business_account',
            entry: [{
                id: '12345',
                changes: [{
                    value: {
                        messaging_product: 'whatsapp',
                        metadata: {
                            display_phone_number: '123456789',
                            phone_number_id: '100100100'
                        },
                        contacts: [{
                            profile: { name: 'John Doe' },
                            wa_id: '5511999999999'
                        }],
                        messages: [{
                            from: '5511999999999',
                            id: 'wamid.HBg...',
                            timestamp: '1700000000',
                            text: { body: 'Hello Webhook' },
                            type: 'text'
                        }]
                    },
                    field: 'messages'
                }]
            }]
          };

          const result = service.parseIncomingMessage(payload);

          expect(result).not.toBeNull();
          expect(result?.from).toBe('5511999999999');
          expect(result?.message).toBe('Hello Webhook');
          expect(result?.contactName).toBe('John Doe');
          expect(result?.phoneNumberId).toBe('100100100');
      });

      it('should return null for status updates (no messages)', () => {
        const payload = {
            entry: [{
                changes: [{
                    value: {
                        statuses: [{
                            id: 'wamid.HBg...',
                            status: 'delivered',
                            timestamp: '1700000005',
                            recipient_id: '5511999999999'
                        }]
                    }
                }]
            }]
        };

        const result = service.parseIncomingMessage(payload);
        // The current implementation returns null if no message is found, which is correct for statuses
        expect(result).toBeNull();
      });
  });
});
