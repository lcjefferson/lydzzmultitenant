#!/usr/bin/env bash
# Expõe o backend (porta 3001) via ngrok para configurar o webhook do WhatsApp.
# Uso: ./start-ngrok.sh   (ou: bash start-ngrok.sh)

set -e
# Backend NestJS usa porta 3001 por padrão
PORT="${PORT:-3001}"

if ! command -v ngrok &> /dev/null; then
  echo "❌ ngrok não está instalado."
  echo ""
  echo "Instale:"
  echo "  macOS (Homebrew):  brew install ngrok/ngrok/ngrok"
  echo "  Ou baixe em:       https://ngrok.com/download"
  echo ""
  echo "Depois crie uma conta em https://ngrok.com e configure:"
  echo "  ngrok config add-authtoken SEU_TOKEN"
  exit 1
fi

echo "🚀 Iniciando ngrok na porta $PORT..."
echo ""
echo "Quando o túnel subir, use no Meta (WhatsApp):"
echo "  URL do Webhook:  https://SEU_SUBDOMINIO.ngrok-free.app/api/webhooks/whatsapp"
echo ""
echo "Opcional: no .env do backend, defina para envio de mídia e callbacks:"
echo "  APP_URL=https://SEU_SUBDOMINIO.ngrok-free.app"
echo ""

exec ngrok http "$PORT"
