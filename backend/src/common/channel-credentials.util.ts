type ChannelLike = {
  config?: unknown;
  accessToken?: string | null;
};

function asConfigRecord(config: unknown): Record<string, unknown> {
  return typeof config === 'object' && config !== null
    ? (config as Record<string, unknown>)
    : {};
}

export function getOfficialWhatsAppCredentials(channel: ChannelLike): {
  accessToken?: string;
  phoneNumberId?: string;
  wabaId?: string;
} {
  const config = asConfigRecord(channel.config);
  const accessToken = String(
    config.accessToken ?? channel.accessToken ?? '',
  ).trim();
  const phoneNumberId = String(config.phoneNumberId ?? '').trim();
  const wabaId = String(config.wabaId ?? '').trim();
  return {
    accessToken: accessToken || undefined,
    phoneNumberId: phoneNumberId || undefined,
    wabaId: wabaId || undefined,
  };
}

export function getUazapiCredentials(channel: ChannelLike): {
  token?: string;
  serverUrl?: string;
  instanceId?: string;
} {
  const config = asConfigRecord(channel.config);
  const token = String(config.token ?? '').trim();
  const serverUrl = String(config.serverUrl ?? '').trim();
  const instanceId = String(config.instanceId ?? '').trim();
  return {
    token: token || undefined,
    serverUrl: serverUrl || undefined,
    instanceId: instanceId || undefined,
  };
}

export function getConfigPhoneNumberId(channel: ChannelLike): string | undefined {
  const { phoneNumberId } = getOfficialWhatsAppCredentials(channel);
  return phoneNumberId;
}
