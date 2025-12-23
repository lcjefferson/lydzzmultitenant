#!/bin/bash

echo "==================================================="
echo "DIAGNÓSTICO E RESTART DO NGINX (HOST)"
echo "==================================================="

# Verifica se está rodando como root
if [ "$EUID" -ne 0 ]; then
  echo "❌ Por favor, rode este script como root (sudo ./fix_nginx.sh)"
  exit 1
fi

echo "1. Verificando status atual..."
systemctl status nginx --no-pager | head -n 10

echo ""
echo "2. Testando arquivos de configuração..."
nginx -t

if [ $? -eq 0 ]; then
    echo "✅ Configuração OK!"
    
    echo ""
    echo "3. Tentando reiniciar o Nginx..."
    systemctl restart nginx
    
    if [ $? -eq 0 ]; then
        echo "✅ Nginx reiniciado com sucesso!"
        echo "Status final:"
        systemctl is-active nginx
    else
        echo "❌ Falha ao reiniciar o Nginx. Verifique os logs: journalctl -xeu nginx"
    fi
else
    echo "❌ A configuração do Nginx tem erros (veja acima). O serviço não será reiniciado até você corrigir."
    echo "Edite o arquivo com erro (geralmente em /etc/nginx/sites-available/...) e tente novamente."
fi
