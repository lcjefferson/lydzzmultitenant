import { ConfigService } from '@nestjs/config';
import { UazapiService } from './uazapi.service';

describe('UazapiService.parseIncomingMessage', () => {
  let service: UazapiService;

  beforeEach(() => {
    service = new UazapiService({
      get: () => undefined,
    } as ConfigService);
  });

  it('parses Fortalabs flat payload with PascalCase fields', () => {
    const result = service.parseIncomingMessage({
      BaseUrl: 'https://fortalabs.uazapi.com',
      owner: '558596713639',
      Chat: '558588127637@s.whatsapp.net',
      Sender: '558588127637@s.whatsapp.net',
      chatid: '558588127637@s.whatsapp.net',
      sender_pn: '558588127637@s.whatsapp.net',
      Text: 'Olá, teste',
      MessageID: 'msg-123',
    });

    expect(result).toEqual(
      expect.objectContaining({
        from: '558588127637',
        message: 'Olá, teste',
        messageId: 'msg-123',
        type: 'text',
        serverUrl: 'https://fortalabs.uazapi.com',
        instanceId: undefined,
      }),
    );
  });

  it('parses Fortalabs payload nested under event object', () => {
    const result = service.parseIncomingMessage({
      owner: 'instance-abc',
      event: {
        Chat: '5511999999999@s.whatsapp.net',
        Sender: '5511999999999@s.whatsapp.net',
        Body: 'Resposta do lead',
        messageId: 'wamid-xyz',
      },
    });

    expect(result).toEqual(
      expect.objectContaining({
        from: '5511999999999',
        message: 'Resposta do lead',
        messageId: 'wamid-xyz',
      }),
    );
  });

  it('ignores Fortalabs metadata-only events without message content', () => {
    const result = service.parseIncomingMessage({
      BaseUrl: 'https://fortalabs.uazapi.com',
      Chat: '558588127637@s.whatsapp.net',
      Sender: '558588127637@s.whatsapp.net',
      chatid: '558588127637@s.whatsapp.net',
      sender_pn: '558588127637@s.whatsapp.net',
    });

    expect(result).toBeNull();
  });

  it('keeps Baileys messages.upsert compatibility', () => {
    const result = service.parseIncomingMessage({
      event: 'messages.upsert',
      owner: 'inst-1',
      data: {
        key: {
          remoteJid: '5511888777666@s.whatsapp.net',
          id: 'baileys-1',
          fromMe: false,
        },
        message: {
          conversation: 'Mensagem clássica',
        },
        messageTimestamp: 1719150000,
      },
    });

    expect(result).toEqual(
      expect.objectContaining({
        from: '5511888777666',
        message: 'Mensagem clássica',
        messageId: 'baileys-1',
        instanceId: 'inst-1',
      }),
    );
  });
});
