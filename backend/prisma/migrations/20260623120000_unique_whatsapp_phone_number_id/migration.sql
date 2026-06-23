-- Unique phone_number_id across WhatsApp official channels (global tenant isolation for webhooks)
CREATE UNIQUE INDEX IF NOT EXISTS "channels_whatsapp_phone_number_id_unique"
ON "channels" ((config->>'phoneNumberId'))
WHERE type = 'whatsapp'
  AND (config->>'phoneNumberId') IS NOT NULL
  AND (config->>'phoneNumberId') <> '';
