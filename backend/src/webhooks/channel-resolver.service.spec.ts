import { ChannelResolverService } from './channel-resolver.service';
import { PrismaService } from '../prisma/prisma.service';

describe('ChannelResolverService', () => {
  let service: ChannelResolverService;
  let prisma: {
    channel: { findMany: jest.Mock };
  };

  const orgA = { id: 'org-a', name: 'Org A', slug: 'org-a' } as any;
  const orgB = { id: 'org-b', name: 'Org B', slug: 'org-b' } as any;

  beforeEach(() => {
    prisma = {
      channel: { findMany: jest.fn() },
    };
    service = new ChannelResolverService(prisma as unknown as PrismaService);
  });

  describe('resolveOfficialWhatsAppChannel', () => {
    it('rejects when phone_number_id is missing', async () => {
      const result = await service.resolveOfficialWhatsAppChannel(undefined);
      expect(result.channel).toBeNull();
      expect(result.error).toBe('missing_phone_number_id');
    });

    it('rejects when no channel matches', async () => {
      prisma.channel.findMany.mockResolvedValue([
        {
          id: 'ch-1',
          type: 'whatsapp',
          config: { phoneNumberId: '111' },
          organization: orgA,
        },
      ]);

      const result = await service.resolveOfficialWhatsAppChannel('999');
      expect(result.channel).toBeNull();
      expect(result.error).toBe('no_match');
    });

    it('rejects duplicate phone_number_id across channels', async () => {
      prisma.channel.findMany.mockResolvedValue([
        {
          id: 'ch-1',
          type: 'whatsapp',
          config: { phoneNumberId: '100' },
          organization: orgA,
        },
        {
          id: 'ch-2',
          type: 'whatsapp',
          config: { phoneNumberId: '100' },
          organization: orgB,
        },
      ]);

      const result = await service.resolveOfficialWhatsAppChannel('100');
      expect(result.channel).toBeNull();
      expect(result.error).toBe('duplicate_phone_number_id');
    });

    it('returns the matching channel', async () => {
      const matched = {
        id: 'ch-ok',
        type: 'whatsapp',
        config: { phoneNumberId: '100' },
        organization: orgB,
      };
      prisma.channel.findMany.mockResolvedValue([
        {
          id: 'ch-other',
          type: 'whatsapp',
          config: { phoneNumberId: '200' },
          organization: orgA,
        },
        matched,
      ]);

      const result = await service.resolveOfficialWhatsAppChannel('100');
      expect(result.error).toBeNull();
      expect(result.channel?.id).toBe('ch-ok');
      expect(result.channel?.organization.id).toBe('org-b');
    });
  });

  describe('resolveUazapiChannel', () => {
    it('rejects when instanceId and token do not match', async () => {
      prisma.channel.findMany.mockResolvedValue([
        {
          id: 'ch-u1',
          type: 'whatsapp',
          provider: 'uazapi',
          config: { instanceId: 'inst-a', token: 'tok-a' },
          organization: orgA,
        },
      ]);

      const result = await service.resolveUazapiChannel('inst-unknown', {});
      expect(result.channel).toBeNull();
      expect(result.error).toBe('no_match');
    });

    it('never falls back to the only uazapi channel without instanceId', async () => {
      prisma.channel.findMany.mockResolvedValue([
        {
          id: 'ch-only',
          type: 'whatsapp',
          provider: 'uazapi',
          config: { instanceId: 'inst-a' },
          organization: orgA,
        },
      ]);

      const result = await service.resolveUazapiChannel(undefined, {});
      expect(result.channel).toBeNull();
      expect(result.error).toBe('no_match');
    });

    it('matches by instanceId', async () => {
      const channel = {
        id: 'ch-u1',
        type: 'whatsapp',
        provider: 'uazapi',
        config: { instanceId: 'Inst-A' },
        organization: orgA,
      };
      prisma.channel.findMany.mockResolvedValue([channel]);

      const result = await service.resolveUazapiChannel('inst-a', {});
      expect(result.channel?.id).toBe('ch-u1');
    });

    it('matches by serverUrl when instanceId looks like a phone number', async () => {
      const channel = {
        id: 'ch-fortalabs',
        type: 'whatsapp',
        provider: 'uazapi',
        config: { serverUrl: 'https://fortalabs.uazapi.com', token: 'tok-a' },
        organization: orgA,
      };
      prisma.channel.findMany.mockResolvedValue([channel]);

      const result = await service.resolveUazapiChannel(
        '558596713639',
        {},
        { serverUrl: 'https://fortalabs.uazapi.com/' },
      );
      expect(result.error).toBeNull();
      expect(result.channel?.id).toBe('ch-fortalabs');
    });
  });
});
